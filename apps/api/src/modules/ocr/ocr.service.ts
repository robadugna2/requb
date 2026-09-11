import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';

export interface OcrResult {
  ftNumber?: string;
  amount?: number;
  bankName?: string;
  depositDate?: string;
  senderName?: string;
  senderAccount?: string;
  receiverAccount?: string;
  branch?: string;
  confidence: number;
  rawText?: string;
  errors?: string[];
}

export interface FtScanResult {
  ftNumbers: string[];
  /** Payer / sender name per FT, read from the statement (pairing input) */
  senders?: Record<string, string>;
  bankName?: string;
  confidence: number;
  detectedVia?: 'gemini' | 'none';
  rawText?: string;
  errors?: string[];
}

/**
 * Receipt OCR for the Telegram bot, powered exclusively by Google Gemini
 * (free tier). There is no fallback provider by design: when no Gemini key
 * is configured the error says so plainly instead of degrading silently.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly geminiService: GeminiService) {}

  async processReceipt(imageUrl: string): Promise<OcrResult> {
    const systemPrompt = `You are an OCR specialist for Ethiopian bank transfer receipts. Extract the following information from the receipt image and return it as JSON:
- ftNumber: The FT/transaction reference number
- amount: The transfer amount (number only, no currency symbol)
- bankName: The bank name (e.g., CBE, Telebirr, Awash, BOA, Dashen)
- depositDate: The transaction date in ISO format (YYYY-MM-DD)
- senderName: The sender's full name
- senderAccount: The sender's account number
- receiverAccount: The receiver's account number
- branch: The bank branch name if visible
- confidence: Your confidence score from 0 to 1 on the extraction accuracy

Return ONLY valid JSON. If a field cannot be determined, omit it from the response. Always include the confidence field.`;
    const userText =
      'Please extract the payment details from this Ethiopian bank transfer receipt:';

    try {
      const content = await this.geminiService.processReceipt(
        imageUrl,
        systemPrompt,
        userText,
      );

      if (!content) {
        this.logger.warn('Gemini not configured or unavailable, OCR processing failed');
        return {
          confidence: 0,
          errors: [
            'Gemini API key is not configured. A super admin can add the free key in Settings → AI Configuration.',
          ],
        };
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          confidence: 0,
          rawText: content,
          errors: ['Could not parse OCR response as JSON'],
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        ftNumber: parsed.ftNumber || undefined,
        amount: parsed.amount ? Number(parsed.amount) : undefined,
        bankName: parsed.bankName || undefined,
        depositDate: parsed.depositDate || undefined,
        senderName: parsed.senderName || undefined,
        senderAccount: parsed.senderAccount || undefined,
        receiverAccount: parsed.receiverAccount || undefined,
        branch: parsed.branch || undefined,
        confidence: parsed.confidence || 0.5,
        rawText: content,
      };
    } catch (error: unknown) {
      this.logger.error('OCR processing error', error);
      return {
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'OCR processing failed'],
      };
    }
  }
}
