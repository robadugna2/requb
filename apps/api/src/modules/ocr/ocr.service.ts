import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';

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
  bankName?: string;
  confidence: number;
  rawText?: string;
  errors?: string[];
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private client: OpenAI | null = null;
  private clientKey: string | null | undefined; // undefined = not resolved yet

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getClient(): Promise<OpenAI | null> {
    const { key } = await this.settingsService.resolveOpenAiKey();
    if (!key) return null;
    if (this.clientKey !== key || !this.client) {
      this.client = new OpenAI({ apiKey: key });
      this.clientKey = key;
    }
    return this.client;
  }

  async processReceipt(imageUrl: string): Promise<OcrResult> {
    const client = await this.getClient();
    if (!client) {
      this.logger.warn('OpenAI not configured, OCR processing is disabled');
      return {
        confidence: 0,
        errors: [
          'OpenAI API key is not configured. A super admin can set it in Settings → AI Configuration.',
        ],
      };
    }

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an OCR specialist for Ethiopian bank transfer receipts. Extract the following information from the receipt image and return it as JSON:
- ftNumber: The FT/transaction reference number
- amount: The transfer amount (number only, no currency symbol)
- bankName: The bank name (e.g., CBE, Telebirr, Awash, BOA, Dashen)
- depositDate: The transaction date in ISO format (YYYY-MM-DD)
- senderName: The sender's full name
- senderAccount: The sender's account number
- receiverAccount: The receiver's account number
- branch: The bank branch name if visible
- confidence: Your confidence score from 0 to 1 on the extraction accuracy

Return ONLY valid JSON. If a field cannot be determined, omit it from the response. Always include the confidence field.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract the payment details from this Ethiopian bank transfer receipt:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        return {
          confidence: 0,
          errors: ['No response from OCR service'],
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

  /**
   * Detects ALL transaction/FT reference numbers visible on a bank statement
   * or receipt photo (a hardcopy statement page can contain many).
   * Accepts a base64 data-URL so no publicly reachable image URL is needed.
   * Only CBE-format references ("FT" + 10 alphanumeric chars) are returned,
   * since CBE is the only bank with a verification API in this app.
   */
  async extractFtNumbers(imageDataUrl: string): Promise<FtScanResult> {
    const client = await this.getClient();
    if (!client) {
      this.logger.warn('OpenAI not configured, FT scanning is disabled');
      return {
        ftNumbers: [],
        confidence: 0,
        errors: [
          'OpenAI API key is not configured. A super admin can set it in Settings → AI Configuration.',
        ],
      };
    }

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an OCR specialist for Ethiopian bank documents. Find ALL transaction reference numbers visible in this image. A single receipt contains one reference number; a bank statement page may contain many rows, each with its own reference number.

Rules:
- CBE (Commercial Bank of Ethiopia) transaction references look like "FT" followed by exactly 10 alphanumeric characters, e.g. FT24AB12345. They usually appear next to labels like "Reference No.", "FT No", "Transaction Ref", "VSC No", or in statement rows.
- Return every reference number you can read, including unclear ones (make your best reading of each).
- Also report which bank the document is from (e.g., CBE, Telebirr, Awash, BOA, Dashen).

Return ONLY valid JSON in this exact shape:
{ "ftNumbers": ["FT...", "..."], "bankName": "CBE", "confidence": 0.85 }`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Find all transaction / FT reference numbers in this bank document photo:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        return { ftNumbers: [], confidence: 0, errors: ['No response from OCR service'] };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ftNumbers: [], confidence: 0, rawText: content, errors: ['Could not parse OCR response as JSON'] };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Normalize each candidate (strip punctuation/spaces the model may have
      // read around the reference) then keep only valid CBE-format numbers.
      const ftNumbers: string[] = Array.from(
        new Set(
          (Array.isArray(parsed.ftNumbers) ? parsed.ftNumbers : [])
            .map((ft: unknown) => String(ft ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
            .filter((ft: string) => /^FT\w{10}$/.test(ft)),
        ),
      );

      return {
        ftNumbers,
        bankName: parsed.bankName || undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        rawText: content,
      };
    } catch (error: unknown) {
      this.logger.error('FT scan processing error', error);
      return {
        ftNumbers: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'FT scanning failed'],
      };
    }
  }
}
