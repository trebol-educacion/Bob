import type { GeminiCallResult } from '@/lib/gemini-client';
import { fail, ok, type ActionResult } from '@/lib/result';

export interface JsonSchemaLike<T> {
  safeParse: (value: unknown) => { success: boolean; data?: T; error?: unknown };
}

/**
 * @param result - callGemini result carrying a text response
 * @param schema - schema the parsed JSON must satisfy
 * @param event - log event name
 * @returns validated data or a failure; never a fallback
 */
export function parseJsonResult<T>(
  result: GeminiCallResult<{ text?: string }>,
  schema: JsonSchemaLike<T>,
  event: string,
): ActionResult<T> {
  if (!result.ok) {
    console.error(JSON.stringify({ event, error: result.error }));
    return fail(result.code, result.retryable);
  }
  const text = result.data.text;
  if (!text) {
    console.error(JSON.stringify({ event, error: 'empty response' }));
    return fail('empty_response', true);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error(JSON.stringify({ event, error: 'invalid JSON' }));
    return fail('invalid_json', true);
  }
  const checked = schema.safeParse(parsed);
  if (!checked.success || checked.data === undefined) {
    console.error(JSON.stringify({ event, error: 'schema mismatch' }));
    return fail('schema_mismatch', true);
  }
  return ok(checked.data);
}
