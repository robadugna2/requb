import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { normalizeFtNumber } from '../../common/utils/ft-number';
import { GEMINI_MODELS_URL, pickBestGeminiModel } from '../../common/utils/gemini-models';
import type { FtScanResult } from './ocr.service';

/**
 * Exact same FT-extraction prompt as OcrService.extractFtNumbers, so both
 * providers produce comparable JSON replies.
 */
const FT_SYSTEM_PROMPT = `You are an OCR specialist for Ethiopian bank documents. Find ALL transaction reference numbers visible in this image. A single receipt contains one reference number; a bank statement page may contain many rows, each with its own reference number.

Rules:
- CBE (Commercial Bank of Ethiopia) transaction references look like "FT" followed by exactly 10 alphanumeric characters, e.g. FT24AB12345. They usually appear next to labels like "Reference No.", "FT No", "Transaction Ref", "VSC No", or in statement rows.
- Return every reference number you can read, including unclear ones (make your best reading of each).
- Also report which bank the document is from (e.g., CBE, Telebirr, Awash, BOA, Dashen).

Return ONLY valid JSON in this exact shape:
{ "ftNumbers": ["FT...", "..."], "bankName": "CBE", "confidence": 0.85 }`;

const FT_USER_PROMPT = 'Find all transaction / FT reference numbers in this bank document photo:';

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Thin Google Gemini REST client (axios only — no SDK dependency). It is the
 * free-tier alternative to OcrService's OpenAI calls: FT scanning and receipt
 * OCR can run without OpenAI credits when a Gemini key is configured.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  /** Auto-detected model per key, refreshed hourly or on model-not-found */
  private modelCache: { key: string; model: string; at: number } | null = null;
  private static MODEL_CACHE_TTL = 60 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  // Axios calls are stateless, so — unlike OcrService's OpenAI client — there
  // is no client object to rebuild when the key changes; the resolved key is
  // simply re-read before every call (cheap: SettingsService caches it in
  // memory, so a key set/cleared by an admin takes effect immediately).
  private async resolveApiKey(): Promise<string | null> {
    const { key } = await this.settingsService.resolveGeminiKey();
    return key;
  }

  /** True when a Gemini key is resolvable from the database or environment. */
  async isConfigured(): Promise<boolean> {
    const { key } = await this.settingsService.resolveGeminiKey();
    return key != null;
  }

  /**
   * Generic vision call: sends the prompt + image to Gemini and returns the
   * model's raw text — or null on any failure (logged, never thrown, so
   * callers can fall through to the next provider).
   */
  async processReceipt(
    imageDataUrl: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string | null> {
    try {
      return await this.generateContent(imageDataUrl, systemPrompt, userText);
    } catch (error: unknown) {
      this.logger.error(
        `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * FT-number extraction with the exact same prompt, JSON parsing and
   * normalization as OcrService.extractFtNumbers (Gemini flavor).
   */
  async extractFtNumbers(imageDataUrl: string): Promise<FtScanResult> {
    try {
      const content = await this.generateContent(imageDataUrl, FT_SYSTEM_PROMPT, FT_USER_PROMPT);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          ftNumbers: [],
          confidence: 0,
          rawText: content,
          errors: ['Could not parse Gemini response as JSON'],
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        ftNumbers?: unknown;
        bankName?: string;
        confidence?: number;
      };

      // Normalize each candidate: strip extended identifiers
      // ("FT24AB123456\BNK" -> "FT24AB123456"), then keep only valid
      // CBE-format numbers.
      const ftNumbers: string[] = Array.from(
        new Set(
          (Array.isArray(parsed.ftNumbers) ? parsed.ftNumbers : [])
            .map((ft: unknown) => normalizeFtNumber(String(ft ?? '')) ?? '')
            .filter((ft: string) => /^FT\w{10}$/.test(ft)),
        ),
      );

      return {
        ftNumbers,
        bankName: parsed.bankName || undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        rawText: content,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Gemini FT scan failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ftNumbers: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Gemini FT scanning failed'],
      };
    }
  }

  /**
   * Core generateContent call. Auto-detects the best available model from
   * Google's live /models list (Google retires models regularly — nothing is
   * hardcoded), and re-detects once if the chosen model 404s mid-flight.
   * Throws on failure so extractFtNumbers can surface the real error;
   * processReceipt wraps it into null.
   */
  private async generateContent(
    imageDataUrl: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    const key = await this.resolveApiKey();
    if (!key) {
      throw new Error('Gemini API key is not configured');
    }

    const match = imageDataUrl.match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) {
      throw new Error('imageDataUrl is not a base64 data-URL');
    }
    const [, mimeType, data] = match;

    const model = await this.getBestModel(key);

    try {
      return await this.callGenerateContent(key, model, mimeType, data, systemPrompt, userText);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isModelGone =
        status === 404 || /not found|not supported|does not (?:exist|have)/i.test(message);
      const usingOverride = !!this.configService.get<string>('GEMINI_MODEL');

      // Retired/renamed model: refresh the auto-detection and retry once
      if (isModelGone && !usingOverride) {
        this.logger.warn(`Gemini model ${model} unavailable — re-detecting from /models list`);
        this.invalidateModelCache();
        const fresh = await this.getBestModel(key);
        return await this.callGenerateContent(key, fresh, mimeType, data, systemPrompt, userText);
      }
      throw error;
    }
  }

  /**
   * Auto-detects the best available Gemini model for this key. GEMINI_MODEL
   * env overrides the detection. Cached per key for an hour.
   */
  private async getBestModel(key: string): Promise<string> {
    const envModel = this.configService.get<string>('GEMINI_MODEL');
    if (envModel) return envModel;

    const cached = this.modelCache;
    if (cached && cached.key === key && Date.now() - cached.at < GeminiService.MODEL_CACHE_TTL) {
      return cached.model;
    }

    const response = await axios.get(GEMINI_MODELS_URL, {
      headers: { 'x-goog-api-key': key },
      timeout: 15000,
    });
    const best = pickBestGeminiModel(response.data?.models ?? []);
    if (!best) {
      throw new Error('No Gemini models with generateContent support are available to this API key');
    }
    this.modelCache = { key, model: best, at: Date.now() };
    this.logger.log(`Auto-detected Gemini model: ${best}`);
    return best;
  }

  private invalidateModelCache() {
    this.modelCache = null;
  }

  private async callGenerateContent(
    key: string,
    model: string,
    mimeType: string,
    data: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    const response = await axios.post<GeminiApiResponse>(
      `${GEMINI_MODELS_URL}/${model}:generateContent`,
      {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userText}` },
              { inline_data: { mime_type: mimeType, data } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      },
      {
        headers: { 'x-goog-api-key': key },
        timeout: 30000,
      },
    );

    const text = (response.data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');

    if (!text) {
      throw new Error('Gemini returned an empty response');
    }
    return text;
  }
}
