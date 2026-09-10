import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import axios from 'axios';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';

const OPENAI_KEY_SETTING = 'openai_api_key';
const GEMINI_KEY_SETTING = 'gemini_api_key';

interface CachedKey {
  key: string | null;
}

@Injectable()
export class SettingsService {
  // Encrypted-key cache keyed by SystemSetting row key ('openai_api_key' |
  // 'gemini_api_key'); a cached null means "checked, not present".
  private cache: Record<string, CachedKey> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ---- OpenAI -----------------------------------------------------------

  /**
   * Returns the OpenAI API key stored in the database (decrypted),
   * or null when it is not set (or the stored value fails to decrypt).
   */
  async getOpenAiKey(): Promise<string | null> {
    return this.getRow(OPENAI_KEY_SETTING);
  }

  /**
   * Database key first; falls back to the OPENAI_API_KEY environment
   * variable. Returns null when neither source has a key.
   */
  async resolveOpenAiKey(): Promise<{ key: string | null; source: 'database' | 'environment' | null }> {
    return this.resolveProviderKey(OPENAI_KEY_SETTING, 'OPENAI_API_KEY');
  }

  async getStatus(): Promise<{
    configured: boolean;
    source: 'database' | 'environment' | null;
    keyHint: string | null;
    updatedAt: string | null;
  }> {
    return this.getProviderStatus(OPENAI_KEY_SETTING, 'OPENAI_API_KEY', 'sk-…');
  }

  async setOpenAiKey(plainKey: string, adminId: string): Promise<void> {
    return this.setRow(OPENAI_KEY_SETTING, plainKey, adminId);
  }

  async clearOpenAiKey(): Promise<void> {
    return this.clearRow(OPENAI_KEY_SETTING);
  }

  async testOpenAiKey(overrideKey?: string): Promise<{ ok: boolean; message: string }> {
    // Test the key the admin just typed (not yet saved) when provided,
    // otherwise the currently configured one.
    const key = overrideKey?.trim()
      ? overrideKey.trim()
      : (await this.resolveOpenAiKey()).key;

    if (!key) {
      return {
        ok: false,
        message:
          'No OpenAI API key configured. Paste a key above and press Test, or set it in Settings → AI Configuration.',
      };
    }

    const client = new OpenAI({ apiKey: key });

    try {
      await Promise.race([
        // A minimal billable call (1 token on the cheapest model) — a free
        // endpoint like models.list() succeeds even with zero credits, which
        // would make an unusable key look "valid and working".
        client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request to OpenAI timed out after 15s')), 15000),
        ),
      ]);
      return { ok: true, message: 'API key is valid and working — OCR and FT scanning are ready.' };
    } catch (error: unknown) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: number }).status
          : undefined;
      const message = error instanceof Error ? error.message : String(error);

      if (status === 401) {
        return { ok: false, message: 'Invalid API key — rejected by OpenAI.' };
      }

      if (status === 429 && /credits|quota|billing/i.test(message)) {
        return {
          ok: false,
          message: 'Key is valid but the OpenAI account has no credits/billing.',
        };
      }

      return {
        ok: false,
        message: `Could not verify API key: ${message}`,
      };
    }
  }

  // ---- Gemini -----------------------------------------------------------

  /**
   * Returns the Gemini API key stored in the database (decrypted),
   * or null when it is not set (or the stored value fails to decrypt).
   */
  async getGeminiKey(): Promise<string | null> {
    return this.getRow(GEMINI_KEY_SETTING);
  }

  /**
   * Database key first; falls back to the GEMINI_API_KEY environment
   * variable. Returns null when neither source has a key.
   */
  async resolveGeminiKey(): Promise<{ key: string | null; source: 'database' | 'environment' | null }> {
    return this.resolveProviderKey(GEMINI_KEY_SETTING, 'GEMINI_API_KEY');
  }

  async getStatusGemini(): Promise<{
    configured: boolean;
    source: 'database' | 'environment' | null;
    keyHint: string | null;
    updatedAt: string | null;
  }> {
    return this.getProviderStatus(GEMINI_KEY_SETTING, 'GEMINI_API_KEY', 'AIza…');
  }

  async setGeminiKey(plainKey: string, adminId: string): Promise<void> {
    return this.setRow(GEMINI_KEY_SETTING, plainKey, adminId);
  }

  async clearGeminiKey(): Promise<void> {
    return this.clearRow(GEMINI_KEY_SETTING);
  }

  /**
   * Self-contained Gemini key check (the settings module cannot import the
   * ocr module — it would be circular): a minimal generateContent call via
   * plain axios. A quota-rejected key (429) is reported as valid-but-throttled
   * so free-tier users aren't told their key is broken.
   */
  async testGeminiKey(overrideKey?: string): Promise<{ ok: boolean; message: string }> {
    // Test the key the admin just typed (not yet saved) when provided,
    // otherwise the currently configured one.
    const key = overrideKey?.trim()
      ? overrideKey.trim()
      : (await this.resolveGeminiKey()).key;

    if (!key) {
      return {
        ok: false,
        message:
          'No Gemini API key configured. Paste a key above and press Test, or set it in Settings → AI Configuration.',
      };
    }

    try {
      await Promise.race([
        axios.post(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
          { contents: [{ parts: [{ text: 'Reply with the single word OK' }] }] },
          { headers: { 'x-goog-api-key': key } },
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request to Gemini timed out after 15s')), 15000),
        ),
      ]);
      return { ok: true, message: 'Gemini API key is valid and working.' };
    } catch (error: unknown) {
      const response =
        typeof error === 'object' && error !== null
          ? (
              error as {
                response?: { status?: number; data?: { error?: { message?: string } } };
              }
            ).response
          : undefined;
      const status = response?.status;
      const message =
        response?.data?.error?.message ??
        (error instanceof Error ? error.message : String(error));

      if (status === 400 && /API key/i.test(message)) {
        return { ok: false, message: 'Invalid Gemini API key — rejected by Google.' };
      }

      if (status === 429) {
        return {
          ok: false,
          message: 'Key is valid but the Gemini free-tier quota is exhausted right now.',
        };
      }

      return {
        ok: false,
        message: `Could not verify Gemini key: ${message}`,
      };
    }
  }

  // ---- Shared encrypted-row plumbing (both providers) --------------------

  /** Decrypted value of a SystemSetting row, cached in memory after first read. */
  private async getRow(settingKey: string): Promise<string | null> {
    const cached = this.cache[settingKey];
    if (cached) {
      return cached.key;
    }

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: settingKey },
    });

    const key = row ? this.decrypt(row.value) : null;
    this.cache[settingKey] = { key };
    return key;
  }

  /** Upserts an encrypted SystemSetting row and warms the cache. */
  private async setRow(settingKey: string, plainKey: string, adminId: string): Promise<void> {
    const trimmed = plainKey.trim();
    const encrypted = this.encrypt(trimmed);

    await this.prisma.systemSetting.upsert({
      where: { key: settingKey },
      update: { value: encrypted, updatedById: adminId },
      create: { key: settingKey, value: encrypted, updatedById: adminId },
    });

    this.cache[settingKey] = { key: trimmed };
  }

  /** Deletes a SystemSetting row and caches the "not present" result. */
  private async clearRow(settingKey: string): Promise<void> {
    await this.prisma.systemSetting.deleteMany({
      where: { key: settingKey },
    });
    this.cache[settingKey] = { key: null };
  }

  /** Database row first, then the provider's environment variable. */
  private async resolveProviderKey(
    settingKey: string,
    envVar: string,
  ): Promise<{ key: string | null; source: 'database' | 'environment' | null }> {
    const dbKey = await this.getRow(settingKey);
    if (dbKey) {
      return { key: dbKey, source: 'database' };
    }

    const envKey = this.configService.get<string>(envVar);
    if (envKey) {
      return { key: envKey, source: 'environment' };
    }

    return { key: null, source: null };
  }

  private async getProviderStatus(
    settingKey: string,
    envVar: string,
    keyPrefix: string,
  ): Promise<{
    configured: boolean;
    source: 'database' | 'environment' | null;
    keyHint: string | null;
    updatedAt: string | null;
  }> {
    const { key, source } = await this.resolveProviderKey(settingKey, envVar);

    if (!key || !source) {
      return { configured: false, source: null, keyHint: null, updatedAt: null };
    }

    let updatedAt: string | null = null;
    if (source === 'database') {
      const row = await this.prisma.systemSetting.findUnique({
        where: { key: settingKey },
        select: { updatedAt: true },
      });
      updatedAt = row ? row.updatedAt.toISOString() : null;
    }

    return {
      configured: true,
      source,
      keyHint: this.maskKey(key, keyPrefix),
      updatedAt,
    };
  }

  private maskKey(key: string, prefix = 'sk-…'): string {
    const last4 = key.slice(-4);
    return `${prefix}${last4}`;
  }

  private encryptionKey(): Buffer {
    return createHash('sha256')
      .update(process.env.JWT_SECRET || 'equb-secret-key')
      .digest();
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  private decrypt(payload: string): string | null {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const tag = Buffer.from(parts[1], 'base64');
      const ciphertext = Buffer.from(parts[2], 'base64');

      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      // Auth tag validation failed (tampered data or wrong encryption key).
      return null;
    }
  }
}
