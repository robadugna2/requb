import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { normalizeFtNumber } from '../../common/utils/ft-number';
import { throttled } from '../../common/utils/ai-throttle';
import { GEMINI_MODELS_URL, pickBestGeminiModel } from '../../common/utils/gemini-models';
import type { FtScanResult } from './ocr.service';

/**
 * Exact same FT-extraction prompt as OcrService.extractFtNumbers, so both
 * providers produce comparable JSON replies. Exported for reuse by the
 * OpenAI-compatible Gemini Web proxy service.
 */
export const FT_SYSTEM_PROMPT = `You are an OCR specialist for Ethiopian bank documents. Read this bank statement / transfer receipt photo and extract every transaction reference number AND the payer (sender) name printed with it.

Rules:
- CBE (Commercial Bank of Ethiopia) transaction references look like "FT" followed by exactly 10 alphanumeric characters, e.g. FT24AB123456. They appear next to labels like "Reference No.", "FT No", "Transaction Ref", "VSC No", or in statement rows. References may be wrapped across two lines inside one table cell — read them as one. Some have extended identifiers after "\\", "/", or "|" (e.g. FT24AB123456\\BNK) — return only the FT part.
- For each FT number, also read the payer / sender / account-holder name printed nearest to it (same row or adjacent cell), if visible. Map it as senders: { "FT...": "PAYER FULL NAME" }.
- Also report which bank the document is from.

Return ONLY valid JSON in this exact shape:
{ "ftNumbers": ["FT...", "..."], "senders": { "FT...": "Payer Full Name" }, "bankName": "CBE", "confidence": 0.9 }`;

export const FT_USER_PROMPT = 'Find all transaction / FT reference numbers in this bank document photo:';

/**
 * Parses a model's JSON reply into normalized FT numbers + per-FT sender
 * names. Shared by the official Gemini service and the web proxy so both
 * providers behave identically.
 */
export function parseFtScanJson(content: string): {
  ftNumbers: string[];
  senders: Record<string, string>;
  bankName?: string;
  confidence: number;
} {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ftNumbers: [], senders: {}, confidence: 0 };

  let parsed: {
    ftNumbers?: unknown;
    senders?: Record<string, unknown>;
    bankName?: string;
    confidence?: number;
  };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { ftNumbers: [], senders: {}, confidence: 0 };
  }

  const ftNumbers: string[] = Array.from(
    new Set(
      (Array.isArray(parsed.ftNumbers) ? parsed.ftNumbers : [])
        .map((ft: unknown) => normalizeFtNumber(String(ft ?? '')) ?? '')
        .filter((ft: string) => /^FT\w{10}$/.test(ft)),
    ),
  );

  const senders: Record<string, string> = {};
  for (const [ft, name] of Object.entries(parsed.senders ?? {})) {
    const clean = normalizeFtNumber(String(ft ?? ''));
    const cleanName = String(name ?? '').trim();
    if (clean && cleanName && /^FT\w{10}$/.test(clean)) senders[clean] = cleanName;
  }

  return {
    ftNumbers,
    senders,
    bankName: parsed.bankName || undefined,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
  };
}

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
  private modelCache = new Map<string, { model: string; at: number }>();
  private static MODEL_CACHE_TTL = 60 * 60 * 1000;
  /** Round-robin cursor — each successful request starts the next one at the
   *  following key, spreading free-tier quota evenly across the pool. */
  private rrIndex = 0;
  /** Keys hard-rejected by Google (400/403) rest here briefly and are skipped */
  private keyCooldown = new Map<string, number>();
  private static KEY_COOLDOWN_MS = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  // Axios calls are stateless, so — unlike OcrService's OpenAI client — there
  // is no client object to rebuild when the key changes; the resolved key is
  // simply re-read before every call (cheap: SettingsService caches it in
  // memory, so a key set/cleared by an admin takes effect immediately).
  /** True when a Gemini key is resolvable from the database or environment. */
  async isConfigured(): Promise<boolean> {
    const keys = await this.settingsService.getGeminiKeys();
    return keys.length > 0;
  }

  /**
   * The whole key pool in the order the next request will use: round-robin
   * start, with hard-rejected (cooldowning) keys pushed to the back unless
   * every key is cooling down.
   */
  private async orderedKeys(): Promise<string[]> {
    const all = await this.settingsService.getGeminiKeys();
    if (all.length === 0) return [];

    const now = Date.now();
    const healthy = all.filter((k) => (this.keyCooldown.get(k) ?? 0) <= now);
    const pool = healthy.length > 0 ? healthy : all;

    const start = this.rrIndex % pool.length;
    return pool.slice(start).concat(pool.slice(0, start));
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
   * normalization as the Gemini Web proxy service (shared parseFtScanJson).
   */
  async extractFtNumbers(imageDataUrl: string): Promise<FtScanResult> {
    try {
      const content = await this.generateContent(imageDataUrl, FT_SYSTEM_PROMPT, FT_USER_PROMPT);
      const parsed = parseFtScanJson(content);
      if (parsed.ftNumbers.length === 0 && !content.includes('{')) {
        return {
          ftNumbers: [],
          senders: {},
          confidence: 0,
          rawText: content,
          errors: ['Could not parse Gemini response as JSON'],
        };
      }
      return {
        ftNumbers: parsed.ftNumbers,
        senders: parsed.senders,
        bankName: parsed.bankName,
        confidence: parsed.confidence,
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
    imageRef: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    const keys = await this.orderedKeys();
    if (keys.length === 0) {
      throw new Error('Gemini API key is not configured');
    }

    // Gemini's REST API only accepts inline base64 image data (unlike OpenAI,
    // it cannot fetch a remote URL), so a Telegram CDN / http image is
    // downloaded server-side first.
    const { mimeType, data } = await this.toInlineData(imageRef);

    // Try every key in rotating order: quota errors / outages on one key
    // fall through to the next; the winner advances the round-robin cursor.
    const failures: string[] = [];
    let lastStatus: number | undefined;
    let lastMessage = 'Gemini request failed';

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const model = await this.getBestModel(key);
        try {
          const text = await this.callGenerateContent(
            key, model, mimeType, data, systemPrompt, userText,
          );
          this.rrIndex = (this.rrIndex + 1) % keys.length;
          return text;
        } catch (error: unknown) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          const message = error instanceof Error ? error.message : String(error);
          const isModelGone =
            status === 404 || /not found|not supported|does not (?:exist|have)/i.test(message);
          const usingOverride = !!this.configService.get<string>('GEMINI_MODEL');

          // Retired/renamed model: refresh the auto-detection and retry once
          if (isModelGone && !usingOverride) {
            this.logger.warn(`Gemini model ${model} unavailable — re-detecting from /models list`);
            this.invalidateModelCache(key);
            const fresh = await this.getBestModel(key);
            const text = await this.callGenerateContent(
              key, fresh, mimeType, data, systemPrompt, userText,
            );
            this.rrIndex = (this.rrIndex + 1) % keys.length;
            return text;
          }

          throw error;
        }
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        const message = error instanceof Error ? error.message : String(error);
        lastStatus = status;
        lastMessage = message;
        failures.push(`key #${i + 1}: ${message}`);

        // Hard-rejected keys cool down so later requests skip them fast
        if (status === 400 || status === 403) {
          this.keyCooldown.set(key, Date.now() + GeminiService.KEY_COOLDOWN_MS);
        }
        // Quota / outage / bad key → fall through to the next key
        this.logger.warn(
          `Gemini key #${i + 1} failed (${status ?? 'no status'}) — trying the next key`,
        );
      }
    }

    this.logger.error(`All ${keys.length} Gemini key(s) failed — ${failures.join(' | ')}`);
    if (keys.length > 1) {
      const friendly = this.friendlyGeminiError(lastStatus, lastMessage).message;
      throw new Error(
        `All ${keys.length} Gemini API keys failed. Last error: ${friendly}`,
      );
    }
    throw this.friendlyGeminiError(lastStatus, lastMessage);
  }

  private isTransientError(status?: number, message = ''): boolean {
    return (
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      /timeout|timed out|network|econnreset|socket hang up|overload|high demand|unavailable/i.test(
        message,
      )
    );
  }

  /** Turns a raw axios/Google error into an actionable message for the admin. */
  private friendlyGeminiError(status?: number, message = ''): Error {
    if (status === 429) {
      return new Error(
        "Gemini's free-tier limit was reached (too many requests). Wait about a minute and try again.",
      );
    }
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      return new Error(
        "Google's Gemini service is temporarily unavailable or overloaded. Please try again in a moment.",
      );
    }
    if (/timeout|timed out|network|econnreset|socket hang up/i.test(message)) {
      return new Error('The request to Gemini timed out. Please try again.');
    }
    return new Error(message || 'Gemini request failed');
  }

  /**
   * Normalizes an image reference to Gemini's inline_data form. Accepts a
   * base64 data-URL (camera scans) or a remote http(s) URL (Telegram CDN) —
   * remote images are fetched server-side because Gemini cannot pull URLs.
   */
  private async toInlineData(
    imageRef: string,
  ): Promise<{ mimeType: string; data: string }> {
    const dataMatch = imageRef.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataMatch) {
      return { mimeType: dataMatch[1], data: dataMatch[2] };
    }

    if (/^https?:\/\//i.test(imageRef)) {
      const response = await axios.get<ArrayBuffer>(imageRef, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 12 * 1024 * 1024,
      });
      const contentType = response.headers['content-type'];
      const mimeType =
        typeof contentType === 'string' && contentType.startsWith('image/')
          ? contentType.split(';')[0].trim()
          : 'image/jpeg';
      return { mimeType, data: Buffer.from(response.data).toString('base64') };
    }

    throw new Error('Image must be a base64 data-URL or an http(s) URL');
  }

  /**
   * Auto-detects the best available Gemini model for this key. GEMINI_MODEL
   * env overrides the detection. Cached per key for an hour.
   */
  private async getBestModel(key: string): Promise<string> {
    const envModel = this.configService.get<string>('GEMINI_MODEL');
    if (envModel) return envModel;

    const cached = this.modelCache.get(key);
    if (cached && Date.now() - cached.at < GeminiService.MODEL_CACHE_TTL) {
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
    this.modelCache.set(key, { model: best, at: Date.now() });
    this.logger.log(`Auto-detected Gemini model: ${best}`);
    return best;
  }

  private invalidateModelCache(key?: string) {
    if (key) this.modelCache.delete(key);
    else this.modelCache.clear();
  }

  private async callGenerateContent(
    key: string,
    model: string,
    mimeType: string,
    data: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    const response = await throttled(() =>
      axios.post<GeminiApiResponse>(
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
          timeout: 60000, // vision calls on larger statements can be slow
        },
      ),
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
