import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { throttled } from '../../common/utils/ai-throttle';
import type { FtScanResult } from './ocr.service';
import { FT_SYSTEM_PROMPT, FT_USER_PROMPT, parseFtScanJson } from './gemini.service';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

/**
 * Client for a self-hosted, OpenAI-compatible Gemini Web proxy
 * (e.g. the "gemini-web2api" project) — the reverse-engineered web endpoint
 * with no API billing and a much higher effective quota than the official
 * free tier. Reached via POST {baseUrl}/chat/completions with standard
 * OpenAI message shapes (text + image_url parts), so multiple statement
 * photos can be sent in ONE call (batching).
 *
 * NOTE: this is an unofficial integration and can rate-limit or break when
 * Google changes its web API. The official Gemini service is the automatic
 * fallback, so a proxy outage degrades rather than fails.
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

  /** Normalize a user-entered base URL to the OpenAI chat-completions endpoint. */
  private chatEndpoint(baseUrl: string): string {
    let base = baseUrl.trim().replace(/\/+$/, '');
    if (/\/v1beta(\/models)?$/i.test(base)) {
      // they pointed at the Gemini-style root; swap to the OpenAI path
      base = base.replace(/\/v1beta(\/models)?$/i, '');
    }
    if (!/\/v1$/i.test(base)) base = `${base}/v1`;
    return `${base}/chat/completions`;
  }

  /**
   * One chat/completions call carrying the prompt + any number of images.
   * Returns the assistant text, or throws on transport/HTTP error.
   */
  private async chat(
    cfg: { baseUrl: string; apiKey: string | null; model: string },
    text: string,
    imageDataUrls: string[],
  ): Promise<string> {
    const content: Array<Record<string, unknown>> = [{ type: 'text', text }];
    for (const url of imageDataUrls) {
      content.push({ type: 'image_url', image_url: { url } });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

    const response = await throttled(() =>
      axios.post<ChatCompletionResponse>(
        this.chatEndpoint(cfg.baseUrl),
        {
          model: cfg.model,
          messages: [{ role: 'user', content }],
          stream: false,
        },
        { headers, timeout: 90000 },
      ),
    );

    const out = response.data?.choices?.[0]?.message?.content;
    if (!out) {
      throw new Error(response.data?.error?.message || 'Gemini Web proxy returned an empty response');
    }
    return out;
  }

  /** FT extraction across one or more statement photos in a single call. */
  async extractFtNumbers(imageDataUrls: string[]): Promise<FtScanResult> {
    const cfg = await this.resolveConfig();
    if (!cfg) {
      return { ftNumbers: [], senders: {}, confidence: 0, errors: ['Gemini Web proxy not configured'] };
    }
    try {
      const content = await this.chat(cfg, `${FT_SYSTEM_PROMPT}\n\n${FT_USER_PROMPT}`, imageDataUrls);
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
      return await this.chat(cfg, `${systemPrompt}\n\n${userText}`, [imageDataUrl]);
    } catch (error: unknown) {
      this.logger.warn(
        `Gemini Web receipt OCR failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Reachability + auth check: a tiny chat call, no image. */
  async test(): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.resolveConfig();
    if (!cfg) {
      return {
        ok: false,
        message: 'Gemini Web proxy is not configured or is disabled. Set the base URL in Settings.',
      };
    }
    try {
      const text = await this.chat(cfg, 'Reply with the single word OK', []);
      return {
        ok: true,
        message: `Gemini Web proxy reachable — model "${cfg.model}" responded.`,
      };
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 401) {
        return { ok: false, message: 'Proxy rejected the API key (401). Check the key in Settings.' };
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
