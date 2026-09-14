import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../ocr/gemini.service';
import { GeminiWebService } from '../ocr/gemini-web.service';
import { normalizeFtNumber } from '../../common/utils/ft-number';

export interface FtDetectionResult {
  ftNumbers: string[];
  /** Payer / sender name per FT, read from the statement (pairing input) */
  senders: Record<string, string>;
  /** Normalized (0–1) [x, y, w, h] location of each FT, when the model reports it */
  regions?: Record<string, [number, number, number, number]>;
  bankName?: string;
  confidence: number;
  detectedVia: 'gemini-web' | 'gemini' | 'none';
  errors?: string[];
}

/**
 * FT detection for camera-scanned bank statements, in priority order:
 *   1. Gemini Web proxy (self-hosted, no billing, high quota) — PRIMARY
 *   2. Official Gemini API — automatic fallback when the proxy is off/unreachable
 * Multiple statement photos are sent in a SINGLE call (batching) to conserve
 * quota. There is no legacy OCR fallback: when both providers fail, the error
 * surfaces verbatim so the admin can act.
 */
@Injectable()
export class FtDetectionService {
  private readonly logger = new Logger(FtDetectionService.name);

  constructor(
    private readonly geminiWebService: GeminiWebService,
    private readonly geminiService: GeminiService,
  ) {}

  async detectAll(imageBuffers: Buffer[]): Promise<FtDetectionResult> {
    const dataUrls = imageBuffers.map(
      (buf) => `data:image/jpeg;base64,${buf.toString('base64')}`,
    );

    const allErrors: string[] = [];

    // 1) Gemini Web proxy (primary), all photos in one batched call
    if (await this.geminiWebService.isConfigured()) {
      const web = await this.geminiWebService.extractFtNumbers(dataUrls);
      if (web.ftNumbers.length > 0) {
        return this.toResult(web, 'gemini-web');
      }
      if (web.errors?.length) allErrors.push(`[Gemini Web proxy] ${web.errors.join(' — ')}`);
      // Proxy reachable but found nothing / errored — fall through to official.
      this.logger.log('Gemini Web proxy returned no FTs — falling back to official Gemini');
    }

    // 2) Official Gemini (fallback). It accepts one image per call; use the
    //    first photo (the proxy already handled true multi-image batching).
    if (await this.geminiService.isConfigured()) {
      const official = await this.geminiService.extractFtNumbers(dataUrls[0]);
      if (official.ftNumbers.length > 0) {
        return this.toResult(official, 'gemini');
      }
      if (official.errors?.length) allErrors.push(`[Gemini API] ${official.errors.join(' — ')}`);
      return this.toResult(official, 'none', allErrors);
    }

    return this.toResult(
      {
        ftNumbers: [],
        senders: {},
        confidence: 0,
        errors: [
          'No AI provider configured. Set the Gemini Web proxy base URL or a Gemini key in Settings → AI Configuration.',
        ],
      },
      'none',
      allErrors,
    );
  }

  private toResult(
    r: {
      ftNumbers: string[];
      senders?: Record<string, string>;
      regions?: Record<string, [number, number, number, number]>;
      bankName?: string;
      confidence: number;
      errors?: string[];
    },
    via: FtDetectionResult['detectedVia'],
    extraErrors?: string[],
  ): FtDetectionResult {
    const senders: Record<string, string> = {};
    for (const [ft, name] of Object.entries(r.senders ?? {})) {
      const clean = normalizeFtNumber(ft);
      const cleanName = String(name ?? '').trim();
      if (clean && cleanName) senders[clean] = cleanName;
    }
    const errors =
      r.ftNumbers.length > 0
        ? undefined
        : [...(extraErrors ?? []), ...(r.errors ?? [])].filter(Boolean).length
          ? [...(extraErrors ?? []), ...(r.errors ?? [])].filter(Boolean)
          : [
              'No CBE FT numbers were detected. Try a closer, well-lit photo, or add the FT number manually below.',
            ];
    return {
      ftNumbers: r.ftNumbers,
      senders,
      regions: r.regions,
      bankName: r.bankName,
      confidence: r.confidence,
      detectedVia: r.ftNumbers.length > 0 ? via : 'none',
      errors,
    };
  }
}
