import 'server-only';

import { GoogleGenAI } from '@google/genai';

/** Context passed to every Gemini call for structured logging. */
export interface GeminiCallContext {
  promptKey: string;
  model: string;
  userId?: string;
}

/** Discriminated union returned by callGemini — never throws. */
export type GeminiCallResult<T> =
  | { ok: true; data: T; latencyMs: number; tokens?: { input?: number; output?: number } }
  | { ok: false; error: string; latencyMs: number };

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/** Wraps any Gemini call: measures latency, logs structured JSON, never throws. */
export async function callGemini<T>(
  ctx: GeminiCallContext,
  fn: (ai: GoogleGenAI) => Promise<T>
): Promise<GeminiCallResult<T>> {
  const { promptKey, model, userId } = ctx;
  const t0 = Date.now();
  try {
    const ai = getClient();
    const data = await fn(ai);
    const latencyMs = Date.now() - t0;
    const tokens = extractTokens(data);
    console.log(JSON.stringify({ event: 'gemini_call', promptKey, model, ok: true, latencyMs, userId, tokens }));
    return { ok: true, data, latencyMs, tokens };
  } catch (err: unknown) {
    const latencyMs = Date.now() - t0;
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'gemini_call', promptKey, model, ok: false, latencyMs, error, userId }));
    return { ok: false, error, latencyMs };
  }
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
