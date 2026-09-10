import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';

const OPENAI_KEY_SETTING = 'openai_api_key';

interface CachedKey {
  key: string | null;
}

@Injectable()
export class SettingsService {
  private cache: CachedKey | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns the OpenAI API key stored in the database (decrypted),
   * or null when it is not set (or the stored value fails to decrypt).
   */
  async getOpenAiKey(): Promise<string | null> {
    if (this.cache) {
      return this.cache.key;
    }

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: OPENAI_KEY_SETTING },
    });

    const key = row ? this.decrypt(row.value) : null;
    this.cache = { key };
    return key;
  }

  /**
   * Database key first; falls back to the OPENAI_API_KEY environment
   * variable. Returns null when neither source has a key.
   */
  async resolveOpenAiKey(): Promise<{ key: string | null; source: 'database' | 'environment' | null }> {
    const dbKey = await this.getOpenAiKey();
    if (dbKey) {
      return { key: dbKey, source: 'database' };
    }

    const envKey = this.configService.get<string>('OPENAI_API_KEY');
    if (envKey) {
      return { key: envKey, source: 'environment' };
    }

    return { key: null, source: null };
  }

  async getStatus(): Promise<{
    configured: boolean;
    source: 'database' | 'environment' | null;
    keyHint: string | null;
    updatedAt: string | null;
  }> {
    const { key, source } = await this.resolveOpenAiKey();

    if (!key || !source) {
      return { configured: false, source: null, keyHint: null, updatedAt: null };
    }

    let updatedAt: string | null = null;
    if (source === 'database') {
      const row = await this.prisma.systemSetting.findUnique({
        where: { key: OPENAI_KEY_SETTING },
        select: { updatedAt: true },
      });
      updatedAt = row ? row.updatedAt.toISOString() : null;
    }

    return {
      configured: true,
      source,
      keyHint: this.maskKey(key),
      updatedAt,
    };
  }

  async setOpenAiKey(plainKey: string, adminId: string): Promise<void> {
    const trimmed = plainKey.trim();
    const encrypted = this.encrypt(trimmed);

    await this.prisma.systemSetting.upsert({
      where: { key: OPENAI_KEY_SETTING },
      update: { value: encrypted, updatedById: adminId },
      create: { key: OPENAI_KEY_SETTING, value: encrypted, updatedById: adminId },
    });

    this.cache = { key: trimmed };
  }

  async clearOpenAiKey(): Promise<void> {
    await this.prisma.systemSetting.deleteMany({
      where: { key: OPENAI_KEY_SETTING },
    });
    this.cache = { key: null };
  }

  async testOpenAiKey(): Promise<{ ok: boolean; message: string }> {
    const { key } = await this.resolveOpenAiKey();

    if (!key) {
      return {
        ok: false,
        message:
          'No OpenAI API key configured. A super admin can set it in Settings → AI Configuration.',
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

  private maskKey(key: string): string {
    const last4 = key.slice(-4);
    return `sk-…${last4}`;
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
