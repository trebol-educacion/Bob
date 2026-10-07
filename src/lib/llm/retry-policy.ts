export interface RetryOptions {
  retries: number;
  timeoutMs: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  isRetryable?: (error: unknown) => boolean;
}

export interface RetryOutcome<T> {
  result: { ok: true; data: T } | { ok: false; error: unknown; timedOut: boolean };
  attempts: number;
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`timeout after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_TEXT = /\b(429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|INTERNAL|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR|fetch failed|network|socket hang up|timeout|timed out|overloaded)\b/i;
const FATAL_TEXT = /\b(400|401|403|404|INVALID_ARGUMENT|PERMISSION_DENIED|UNAUTHENTICATED|NOT_FOUND|FAILED_PRECONDITION)\b/;

/**
 * @param error - thrown value
 * @returns HTTP status when one can be read from the error
 */
export function extractStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const candidate = (error as { status?: unknown; code?: unknown }).status ?? (error as { code?: unknown }).code;
  return typeof candidate === 'number' ? candidate : undefined;
}

/**
 * @param error - thrown value
 * @returns true when the failure is transient and worth retrying
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  const status = extractStatus(error);
  if (status !== undefined) return RETRYABLE_STATUS.has(status);
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (FATAL_TEXT.test(message)) return false;
  return RETRYABLE_TEXT.test(message);
}

/**
 * @param error - thrown value
 * @returns stable failure code
 */
export function classifyError(error: unknown): string {
  if (error instanceof TimeoutError) return 'timeout';
  const status = extractStatus(error);
  if (status !== undefined) return `http_${status}`;
  return isRetryableError(error) ? 'transient' : 'permanent';
}

/**
 * @param attempt - zero-based retry index
 * @param baseDelayMs - first delay
 * @param maxDelayMs - cap
 * @param random - value in [0,1)
 * @returns full-jitter exponential backoff in ms
 */
export function computeBackoffMs(attempt: number, baseDelayMs: number, maxDelayMs: number, random: () => number = Math.random): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.floor(ceiling * 0.5 + ceiling * 0.5 * random());
}

async function runOnce<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new TimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param fn - operation receiving an AbortSignal
 * @param options - retries, timeoutMs and optional backoff tuning
 * @returns outcome with the attempt count, never throws
 */
export async function runWithRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions,
): Promise<RetryOutcome<T>> {
  const {
    retries,
    timeoutMs,
    baseDelayMs = 500,
    maxDelayMs = 4000,
    random = Math.random,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    isRetryable = isRetryableError,
  } = options;

  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const data = await runOnce(fn, timeoutMs);
      return { result: { ok: true, data }, attempts };
    } catch (error) {
      const canRetry = attempts <= retries && isRetryable(error);
      if (!canRetry) {
        return { result: { ok: false, error, timedOut: error instanceof TimeoutError }, attempts };
      }
      await sleep(computeBackoffMs(attempts - 1, baseDelayMs, maxDelayMs, random));
    }
  }
}
