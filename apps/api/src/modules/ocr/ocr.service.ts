import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not configured. OCR processing is disabled.',
      );
    }
  }

  async processReceipt(imageUrl: string): Promise<OcrResult> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, OCR processing is disabled');
      return {
        confidence: 0,
        errors: ['OCR processing is disabled. Please configure OPENAI_API_KEY.'],
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
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
}
