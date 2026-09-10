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
const NEAR_MISS_REGEX = /\bFT[A-Z0-9]{9,12}\b/g;

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
 * Repair candidates for an OCR near-miss: an inserted character makes the
 * token 11 chars, so deleting any single character can recover the real FT.
 * Only format-valid candidates are returned; existence is confirmed against
 * the free CBE API by the caller.
 */
export function repairCandidates(token: string): string[] {
  const tail = token.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2);
  if (tail.length !== 11) return [];
  const candidates = new Set<string>();
  for (let i = 0; i < tail.length; i++) {
    const candidate = 'FT' + tail.slice(0, i) + tail.slice(i + 1);
    if (/^FT[A-Z0-9]{10}$/.test(candidate)) candidates.add(candidate);
  }
  return [...candidates];
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
        strictFts(data.text).forEach((ft) => ftSet.add(ft));
        nearMissTokens(data.text, ftSet).forEach((t) => missSet.add(t));
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
