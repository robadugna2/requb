import { Injectable } from '@nestjs/common';
import { GeminiService } from '../ocr/gemini.service';
import { normalizeFtNumber } from '../../common/utils/ft-number';

export interface FtDetectionResult {
  ftNumbers: string[];
  /** Payer / sender name per FT, read from the statement (pairing input) */
  senders: Record<string, string>;
  bankName?: string;
  confidence: number;
  detectedVia: 'gemini' | 'none';
  errors?: string[];
}

/**
 * Gemini-only FT detection: the vision model reads the statement photo
 * (camera shot or uploaded image) and returns every CBE FT reference plus
 * the payer / sender name printed beside it, which drives automatic member
 * pairing. There is deliberately no fallback OCR — when Gemini is not
 * configured or fails, the error surfaces verbatim so the admin can act
 * (add the free key in Settings) instead of getting silently bad results.
 */
@Injectable()
export class FtDetectionService {
  constructor(private readonly geminiService: GeminiService) {}

  async detectAll(imageBuffer: Buffer): Promise<FtDetectionResult> {
    const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    const result = await this.geminiService.extractFtNumbers(imageDataUrl);

    // Clean the sender map: valid FT keys only, trimmed names
    const senders: Record<string, string> = {};
    for (const [ft, name] of Object.entries(result.senders ?? {})) {
      const clean = normalizeFtNumber(ft);
      const cleanName = String(name ?? '').trim();
      if (clean && cleanName) senders[clean] = cleanName;
    }

    return {
      ftNumbers: result.ftNumbers,
      senders,
      bankName: result.bankName,
      confidence: result.confidence,
      detectedVia: result.ftNumbers.length > 0 ? 'gemini' : 'none',
      errors:
        result.ftNumbers.length > 0
          ? undefined
          : result.errors && result.errors.length
            ? result.errors
            : [
                'No CBE FT numbers were detected in the image. Try a closer, well-lit photo, or add the FT number manually below.',
              ],
    };
  }
}
