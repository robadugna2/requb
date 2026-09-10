import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createWorker, PSM } from 'tesseract.js';
import Jimp from 'jimp';
import jsQR from 'jsqr';
import { tmpdir } from 'os';
import { join } from 'path';
import { OcrService, FtScanResult } from './ocr.service';

const STRICT_FT_REGEX = /\bFT[A-Z0-9]{10}\b/g;
const NEAR_MISS_REGEX = /\bFT[A-Z0-9]{9,15}\b/g;
/** An FT fragment that can't be complete: "FT" + 2..9 chars */
const FT_FRAGMENT_REGEX = /^FT[A-Z0-9]{2,9}$/;
/** A plausible wrapped continuation: 1-4 alphanumerics, optionally starting
 *  with a suffix separator ("\", "/" or "|") */
const CONTINUATION_REGEX = /^[\\/|]?[A-Z0-9]{1,4}$/;

function strictFts(text: string): string[] {
  return Array.from(new Set(text.toUpperCase().match(STRICT_FT_REGEX) ?? []));
}

/**
 * Tokens that look like FT references but failed the strict 10-char check —
 * OCR misreads (inserted/dropped/confused characters). The controller can
 * propose single-deletion repairs for these and confirm them against CBE.
 */
function nearMissTokens(text: string, alreadyFound: Set<string>): string[] {
  return (text.toUpperCase().match(NEAR_MISS_REGEX) ?? []).filter(
    (token) => !alreadyFound.has(token),
  );
}

/**
 * Rejoins FT references that a statement table wrapped across two lines
 * inside one cell, e.g.:
 *
 *   "FT24AB12"          "FT1234567890\"
 *   "3456"              "DX"
 *
 * When a line ends with an incomplete FT fragment (FT + 2..9 chars) and the
 * next line starts with a short continuation token, the two are merged; the
 * same merge is applied within a single line. If the fragment already
 * contains a suffix separator, the FT part before it is complete and the
 * continuation only extends the suffix — normalizeFtNumber strips that later,
 * so merging is still correct. Wrong joins are harmless: they simply fail the
 * CBE lookup and the admin fixes the chip manually.
 */
export function joinWrappedFtLines(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const mergeTokenPair = (firstRaw: string, secondRaw: string): string | null => {
    const first = firstRaw.toUpperCase();
    const second = secondRaw.toUpperCase();
    const cont = second.replace(/[^A-Z0-9]/g, '');
    if (!cont || !CONTINUATION_REGEX.test(second)) return null;
    // A trailing separator ("\") marks the start of a suffix; the FT part is
    // what precedes it.
    const sepMatch = first.match(/[\\/|]+$/);
    const base = sepMatch ? first.slice(0, -sepMatch[0].length) : first;
    if (!FT_FRAGMENT_REGEX.test(base)) return null;
    // Keep the separator after the rejoined FT: it still marks the suffix
    // (which normalizeFtNumber strips), and an empty separator slot would
    // instead glue the suffix into the FT itself.
    const sep = sepMatch ? sepMatch[0] : '';
    return base + cont + sep;
  };

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let tokens = lines[i].split(/\s+/);

    // Same-line wrap: "... FT24AB12 3456 ..." -> "... FT24AB123456 ..."
    for (let j = 0; j < tokens.length - 1; j++) {
      const merged = mergeTokenPair(tokens[j], tokens[j + 1]);
      if (merged) {
        tokens = [...tokens.slice(0, j), merged, ...tokens.slice(j + 2)];
        break;
      }
    }

    // Cross-line wrap: line ends with an FT fragment, next line continues it
    const ftIdx = tokens.findIndex((t) =>
      FT_FRAGMENT_REGEX.test(t.toUpperCase().replace(/[\\/|]+$/, '')),
    );
    if (ftIdx >= 0 && i + 1 < lines.length) {
      const nextTokens = lines[i + 1].split(/\s+/);
      const merged = mergeTokenPair(
        tokens[ftIdx].toUpperCase(),
        nextTokens[0] ?? '',
      );
      if (merged) {
        tokens[ftIdx] = merged;
        nextTokens.shift();
        i++; // the continuation line is consumed
        if (nextTokens.length) out.push(nextTokens.join(' '));
        out.push(tokens.join(' '));
        continue;
      }
    }

    out.push(tokens.join(' '));
  }
  return out.join('\n');
}

/**
 * Repair candidates for an OCR near-miss:
 *  - Merged extended identifier (separator lost in OCR): "FT24AB123456BNK"
 *    -> "FT24AB123456" (truncate to the first 10 chars after FT).
 *  - Inserted character: "FT99Z27876543" -> delete any single position.
 * Only format-valid candidates are returned; existence is confirmed against
 * the free CBE API by the caller.
 */
export function repairCandidates(token: string): string[] {
  const tail = token.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2);
  const candidates = new Set<string>();
  if (tail.length > 10) {
    candidates.add('FT' + tail.slice(0, 10));
  }
  if (tail.length === 11) {
    for (let i = 0; i < tail.length; i++) {
      candidates.add('FT' + tail.slice(0, i) + tail.slice(i + 1));
    }
  }
  return [...candidates].filter((c) => /^FT[A-Z0-9]{10}$/.test(c));
}

/**
 * Free, key-less FT-number detection pipeline for camera-scanned bank
 * statements/receipts:
 *   1. QR code — CBE receipts embed the FT in a QR code; exact and instant.
 *   2. Tesseract.js OCR — reads printed FT references off statement pages
 *      (two segmentation passes merged for recall, plus rotated retries to
 *      survive EXIF-rotated gallery photos).
 *   3. OpenAI (optional) — only if a funded key is configured, and only when
 *      the free passes found nothing.
 * CBE verification afterwards is a free public API.
 */
@Injectable()
export class FtDetectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(FtDetectionService.name);
  private workerPromise: ReturnType<typeof createWorker> | null = null;

  constructor(private readonly ocrService: OcrService) {}

  async detectAll(imageBuffer: Buffer): Promise<FtScanResult> {
    // 1) QR — exact, instant, works even on poor photos
    try {
      const qrFts = await this.detectFromQr(imageBuffer);
      if (qrFts.length) {
        return { ftNumbers: qrFts, confidence: 1, detectedVia: 'qr' };
      }
    } catch (err: unknown) {
      this.logger.warn(
        `QR detection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2) Free on-device OCR
    try {
      const ocr = await this.detectFromImageText(imageBuffer);
      if (ocr.ftNumbers.length || ocr.nearMisses.length) {
        return {
          ftNumbers: ocr.ftNumbers,
          nearMisses: ocr.nearMisses,
          confidence: Math.round(ocr.confidence) / 100,
          detectedVia: 'ocr',
        };
      }
    } catch (err: unknown) {
      this.logger.error(
        `Tesseract OCR failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 3) Optional OpenAI fallback (no-op error result when unconfigured)
    const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    const ai = await this.ocrService.extractFtNumbers(dataUrl);
    if (ai.ftNumbers.length) {
      return { ...ai, detectedVia: 'ai' };
    }

    // Don't blame the optional AI layer when it simply isn't configured
    const aiError = ai.errors?.find((e) => !e.includes('not configured'));
    return {
      ftNumbers: [],
      confidence: 0,
      detectedVia: 'none',
      errors: [
        aiError ??
          'No CBE FT numbers were detected. Try a closer, well-lit photo, or add the FT number manually below.',
      ],
    };
  }

  /**
   * Decodes a QR code (CBE receipts embed the FT) and returns any CBE-format
   * FT numbers found in its payload. QR scanning is rotation-invariant.
   */
  private async detectFromQr(buffer: Buffer): Promise<string[]> {
    const image = await Jimp.read(buffer);

    const scan = (img: Jimp): string | null =>
      jsQR(
        new Uint8ClampedArray(img.bitmap.data),
        img.bitmap.width,
        img.bitmap.height,
      )?.data ?? null;

    let payload = scan(image);
    if (!payload && image.bitmap.width < 800) {
      payload = scan(image.clone().resize(1000, Jimp.AUTO));
    }
    if (!payload) return [];

    this.logger.log(`QR payload decoded (${payload.length} chars)`);
    return strictFts(payload);
  }

  /**
   * Runs Tesseract OCR (grayscale + contrast-normalized, 2x upscale) with two
   * page-segmentation passes whose strict matches are merged for recall, and
   * collects near-miss tokens for the controller's CBE-verified repair pass.
   * Retries at 90/180/270° when nothing is found, which absorbs EXIF-rotated
   * gallery photos and sideways scans.
   */
  private async detectFromImageText(
    buffer: Buffer,
  ): Promise<{ ftNumbers: string[]; nearMisses: string[]; confidence: number }> {
    const worker = await this.getWorker();
    const base = (await Jimp.read(buffer)).greyscale().normalize().contrast(0.25);
    const upscaled = base
      .clone()
      .resize(base.bitmap.width * 2, Jimp.AUTO, Jimp.RESIZE_BILINEAR);

    const ocrPass = async (img: Jimp, psm: PSM) => {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      return worker.recognize(await img.getBufferAsync(Jimp.MIME_PNG));
    };

    const scanAngles = async (img: Jimp): Promise<{
      ftNumbers: string[];
      nearMisses: string[];
      confidence: number;
    } | null> => {
      const ftSet = new Set<string>();
      const missSet = new Set<string>();
      let bestConfidence = 0;

      // Two segmentation modes catch different statement layouts
      for (const psm of [PSM.AUTO, PSM.SINGLE_BLOCK] as PSM[]) {
        const { data } = await ocrPass(img, psm);
        bestConfidence = Math.max(bestConfidence, data.confidence ?? 0);
        // Rejoin table-wrapped FT references before extraction
        const text = joinWrappedFtLines(data.text);
        strictFts(text).forEach((ft) => ftSet.add(ft));
        nearMissTokens(text, ftSet).forEach((t) => missSet.add(t));
      }
      if (ftSet.size === 0 && missSet.size === 0) return null;
      return { ftNumbers: [...ftSet], nearMisses: [...missSet], confidence: bestConfidence };
    };

    // Upright first (most common); rotated variants only as a fallback
    let result = await scanAngles(upscaled);
    if (!result) {
      for (const angle of [90, 180, 270]) {
        result = await scanAngles(upscaled.clone().rotate(angle));
        if (result) {
          this.logger.log(`FT text found after ${angle}° rotation`);
          break;
        }
      }
    }
    return result ?? { ftNumbers: [], nearMisses: [], confidence: 0 };
  }

  /** Lazily spawns and reuses a single Tesseract worker (expensive to create). */
  private getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('eng', 1, {
        cachePath: join(tmpdir(), 'equb-tesseract'),
        logger: () => undefined,
      });
    }
    return this.workerPromise;
  }

  async onApplicationShutdown() {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }
}
