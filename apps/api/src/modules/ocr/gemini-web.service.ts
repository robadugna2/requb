import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { throttled } from '../../common/utils/ai-throttle';
import type { FtScanResult } from './ocr.service';
import { FT_SYSTEM_PROMPT, FT_USER_PROMPT, parseFtScanJson } from './gemini.service';

interface NativeGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

/**
 * Client for a self-hosted, Google-NATIVE Gemini Web proxy
 * (the "gemini-web2api" project) — the same integration pattern as the
 * live tender agent: POST {proxyBase}/v1beta/models/{model}:generateContent
 * with a Google-native body (contents/parts, camelCase generationConfig).
 *
 * This is the user's proven, production-working path: no API key or billing
 * needed for Flash models (key query-param only when the proxy sets api_keys),
 * and it accepts MULTIPLE inlineData images in one call (batching) — each is
 * uploaded through Gemini Web's own upload endpoint by the proxy.
 *
 * NOTE: unofficial integration — when the proxy is unreachable the official
 * Gemini service is the automatic fallback, so a proxy outage degrades rather
 * than fails.
 */
@Injectable()
export class GeminiWebService {
  private readonly logger = new Logger(GeminiWebService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async resolveConfig(): Promise<{
    baseUrl: string;
    apiKey: string | null;
    model: string;
  } | null> {
    const cfg = await this.settingsService.getGeminiWebConfig();
    if (!cfg || !cfg.enabled || !cfg.baseUrl) return null;
    return { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model };
  }

  async isConfigured(): Promise<boolean> {
    return (await this.resolveConfig()) != null;
  }

  /** Base URL -> native generateContent endpoint (mirrors lib/gemini.ts). */
  private generateUrl(baseUrl: string, model: string, apiKey: string | null): string {
    let base = baseUrl.trim().replace(/\/+$/, '');
    base = base.replace(/\/v1$/i, '').replace(/\/v1beta(\/models)?$/i, '');
    const url = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    return apiKey ? `${url}?key=${encodeURIComponent(apiKey)}` : url;
  }

  /** Data-URL or http(s) URL -> { mimeType, base64 } (Gemini inline format). */
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
   * One native generateContent call carrying the prompt + any number of
   * images (each uploaded through Gemini Web by the proxy). Returns the
   * joined assistant text, or throws on transport/HTTP error.
   */
  private async generateNative(
    cfg: { baseUrl: string; apiKey: string | null; model: string },
    text: string,
    imageDataUrls: string[],
  ): Promise<string> {
    const parts: Array<Record<string, unknown>> = [{ text }];
    for (const url of imageDataUrls) {
      const { mimeType, data } = await this.toInlineData(url);
      parts.push({ inlineData: { mimeType, data } });
    }

    const response = await throttled(() =>
      axios.post<NativeGenerateResponse>(
        this.generateUrl(cfg.baseUrl, cfg.model, cfg.apiKey),
        {
          // camelCase so the proxy AND the official API parse it identically
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0 },
        },
        { timeout: 120000 },
      ),
    );

    const candidate = response.data?.candidates?.[0];
    const out = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!out) {
      const reason = candidate?.finishReason
        ? ` (finishReason: ${candidate.finishReason})`
        : '';
      throw new Error(`Gemini Web proxy returned an empty generation${reason}`);
    }
    return out;
  }

  /**
   * FT extraction across one or more statement photos in a single call.
   * Same prompt + JSON contract as the official Gemini service.
   */
  async extractFtNumbers(imageDataUrls: string[]): Promise<FtScanResult> {
    const cfg = await this.resolveConfig();
    if (!cfg) {
      return { ftNumbers: [], senders: {}, confidence: 0, errors: ['Gemini Web proxy not configured'] };
    }
    try {
      const content = await this.generateNative(
        cfg,
        `${FT_SYSTEM_PROMPT}\n\n${FT_USER_PROMPT}`,
        imageDataUrls,
      );
      const parsed = parseFtScanJson(content);
      return {
        ftNumbers: parsed.ftNumbers,
        senders: parsed.senders,
        bankName: parsed.bankName,
        confidence: parsed.confidence,
        rawText: content,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Gemini Web FT scan failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ftNumbers: [],
        senders: {},
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Gemini Web proxy request failed'],
      };
    }
  }

  /** Receipt OCR via the proxy (Telegram flow), returning raw text or null. */
  async processReceipt(
    imageDataUrl: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string | null> {
    const cfg = await this.resolveConfig();
    if (!cfg) return null;
    try {
      return await this.generateNative(cfg, `${systemPrompt}\n\n${userText}`, [imageDataUrl]);
    } catch (error: unknown) {
      this.logger.warn(
        `Gemini Web receipt OCR failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Reachability + model check: a tiny native call, no image. */
  async test(): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.resolveConfig();
    if (!cfg) {
      return {
        ok: false,
        message: 'Gemini Web proxy is not configured or is disabled. Set the base URL in Settings.',
      };
    }
    try {
      const text = await this.generateNative(cfg, 'Reply with the single word OK', []);
      return {
        ok: true,
        message: `Gemini Web proxy reachable — model "${cfg.model}" responded: ${text.slice(0, 20)}`,
      };
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 400 && /api key/i.test(message)) {
        return { ok: false, message: 'Proxy rejected the API key (400). Check the key in Settings.' };
      }
      if (!status) {
        return {
          ok: false,
          message: `Cannot reach the proxy at ${cfg.baseUrl}. Is the server running and reachable from the API host? (${message})`,
        };
      }
      return { ok: false, message: `Proxy error (${status}): ${message}` };
    }
  }
}
