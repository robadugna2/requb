/**
 * Small HTTP helper shared by the bank adapters.
 *
 * Why not the app's axios default: several Ethiopian bank receipt hosts serve
 * legacy TLS chains and non-standard content types, and some are only reachable
 * with a browser-ish User-Agent. This wraps those quirks in one place.
 */
import axios, { type AxiosRequestConfig } from 'axios';
import * as https from 'https';

/** Browser-like UA — some receipt hosts reject unknown clients. */
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

/**
 * Some bank hosts present certificates that Node's bundled CA list rejects.
 * These are public receipt pages, not authenticated APIs, so we relax
 * verification for them specifically — mirroring what the existing
 * CbeVerificationService already does for apps.cbe.com.et.
 */
const relaxedAgent = new https.Agent({ rejectUnauthorized: false });

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Return raw bytes instead of decoded text (CBE serves a PDF). */
  asBuffer?: boolean;
}

export interface FetchOutcome {
  status: number;
  contentType: string;
  /** Decoded body when asBuffer was false. */
  text: string;
  /** Raw bytes when asBuffer was true. */
  buffer?: Buffer;
  finalUrl: string;
}

/**
 * GET a bank receipt endpoint.
 * Throws only on transport failure; HTTP error statuses are returned so the
 * adapter can decide whether they mean "not found" or "something is wrong".
 */
export async function fetchBankEndpoint(
  url: string,
  options: FetchOptions = {},
): Promise<FetchOutcome> {
  const config: AxiosRequestConfig = {
    method: 'GET',
    url,
    timeout: options.timeoutMs ?? 15000,
    httpsAgent: relaxedAgent,
    responseType: options.asBuffer ? 'arraybuffer' : 'text',
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: '*/*',
      ...options.headers,
    },
    // Preserve the raw body so regex parsing sees the bank's real markup.
    transformResponse: [(data: unknown) => data],
  };

  const response = await axios.request(config);
  const contentType = String(response.headers?.['content-type'] ?? '');

  if (options.asBuffer) {
    return {
      status: response.status,
      contentType,
      text: '',
      buffer: Buffer.from(response.data as ArrayBuffer),
      finalUrl: url,
    };
  }

  return {
    status: response.status,
    contentType,
    text: typeof response.data === 'string' ? response.data : String(response.data ?? ''),
    finalUrl: url,
  };
}
