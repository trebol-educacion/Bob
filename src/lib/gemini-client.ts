import 'server-only';

import { GoogleGenAI } from '@google/genai';
import { classifyError, isRetryableError, runWithRetry } from '@/lib/llm/retry-policy';

const TEXT_TIMEOUT_MS = 25_000;
const MEDIA_TIMEOUT_MS = 60_000;
const CLIENT_CEILING_MS = 90_000;
const DEFAULT_RETRIES = 2;
const MEDIA_MODEL_PATTERN = /(tts|image)/i;

/**
 * @param model - Gemini model id
 * @returns default per-attempt timeout for that model family
 */
export function defaultTimeoutMs(model: string): number {
  return MEDIA_MODEL_PATTERN.test(model) ? MEDIA_TIMEOUT_MS : TEXT_TIMEOUT_MS;
}

/** Context passed to every Gemini call for structured logging. */
export interface GeminiCallContext {
  promptKey: string;
  model: string;
  userId?: string;
  timeoutMs?: number;
  retries?: number;
}

/** Discriminated union returned by callGemini, never throws. */
export type GeminiCallResult<T> =
  | { ok: true; data: T; latencyMs: number; tokens?: { input?: number; output?: number } }
  | { ok: false; error: string; latencyMs: number; retryable: boolean; code: string; attempts: number };

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    _client = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: CLIENT_CEILING_MS } });
  }
  return _client;
}

/** Wraps any Gemini call: timeout, retries with backoff, latency, structured logs; never throws. */
export async function callGemini<T>(
  ctx: GeminiCallContext,
  fn: (ai: GoogleGenAI, signal: AbortSignal) => Promise<T>
): Promise<GeminiCallResult<T>> {
  const { promptKey, model, userId } = ctx;
  const t0 = Date.now();
  let ai: GoogleGenAI;
  try {
    ai = getClient();
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'gemini_call', promptKey, model, ok: false, latencyMs: 0, error, userId }));
    return { ok: false, error, latencyMs: 0, retryable: false, code: 'config', attempts: 0 };
  }
  const { result, attempts } = await runWithRetry((signal) => fn(ai, signal), {
    retries: ctx.retries ?? DEFAULT_RETRIES,
    timeoutMs: ctx.timeoutMs ?? defaultTimeoutMs(model),
  });
  const latencyMs = Date.now() - t0;
  if (result.ok) {
    const tokens = extractTokens(result.data);
    console.log(JSON.stringify({ event: 'gemini_call', promptKey, model, ok: true, latencyMs, attempts, userId, tokens }));
    return { ok: true, data: result.data, latencyMs, tokens };
  }
  const error = result.error instanceof Error ? result.error.message : String(result.error);
  const code = classifyError(result.error);
  console.error(JSON.stringify({ event: 'gemini_call', promptKey, model, ok: false, latencyMs, attempts, code, error, userId }));
  return { ok: false, error, latencyMs, retryable: isRetryableError(result.error), code, attempts };
}

/** Type guard: narrows GeminiCallResult to the success branch. */
export function isOk<T>(r: GeminiCallResult<T>): r is { ok: true; data: T; latencyMs: number; tokens?: { input?: number; output?: number } } {
  return r.ok === true;
}

/** Safely extracts token counts from a Gemini response if present. */
function extractTokens(data: unknown): { input?: number; output?: number } | undefined {
  if (
    data !== null &&
    typeof data === 'object' &&
    'usageMetadata' in data &&
    data.usageMetadata !== null &&
    typeof data.usageMetadata === 'object'
  ) {
    const meta = data.usageMetadata as Record<string, unknown>;
    return {
      input: typeof meta.promptTokenCount === 'number' ? meta.promptTokenCount : undefined,
      output: typeof meta.candidatesTokenCount === 'number' ? meta.candidatesTokenCount : undefined,
    };
  }
  return undefined;
}

/**
 * Opens a Gemini stream with the same timeout and retry policy as callGemini.
 * The policy covers only establishing the stream. Never throws: a failure mid-stream
 * is the caller's to handle while iterating.
 */
export async function streamGemini<T extends { text?: string }>(
  ctx: GeminiCallContext,
  fn: (ai: GoogleGenAI, signal: AbortSignal) => Promise<AsyncIterable<T>>
): Promise<{ ok: true; stream: AsyncIterable<T> } | { ok: false; error: string; retryable: boolean; code: string }> {
  const { promptKey, model, userId } = ctx;
  let ai: GoogleGenAI;
  try {
    ai = getClient();
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'gemini_stream_start', promptKey, model, ok: false, error, userId }));
    return { ok: false, error, retryable: false, code: 'config' };
  }
  const { result, attempts } = await runWithRetry((signal) => fn(ai, signal), {
    retries: ctx.retries ?? DEFAULT_RETRIES,
    timeoutMs: ctx.timeoutMs ?? defaultTimeoutMs(model),
  });
  if (result.ok) {
    console.log(JSON.stringify({ event: 'gemini_stream_start', promptKey, model, attempts, userId }));
    return { ok: true, stream: result.data };
  }
  const error = result.error instanceof Error ? result.error.message : String(result.error);
  const code = classifyError(result.error);
  console.error(JSON.stringify({ event: 'gemini_stream_start', promptKey, model, ok: false, attempts, code, error, userId }));
  return { ok: false, error, retryable: isRetryableError(result.error), code };
}

/** Wraps Zod safeParse: returns fallback and logs on failure instead of throwing. */
export function safeParseFallback<T>(
  schema: { safeParse: (x: unknown) => { success: boolean; data?: T; error?: unknown } },
  raw: unknown,
  fallback: T
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.error(JSON.stringify({ event: 'safeParse_fallback', error: String(result.error) }));
    return fallback;
  }
  return result.data as T;
}
