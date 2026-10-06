import {
  TimeoutError,
  classifyError,
  computeBackoffMs,
  isRetryableError,
  runWithRetry,
} from '@/lib/llm/retry-policy';

class HttpError extends Error {
  constructor(public status: number, message = `status ${status}`) {
    super(message);
  }
}

const noSleep = async () => undefined;

describe('isRetryableError', () => {
  it.each([429, 500, 502, 503, 504])('retries HTTP %i', (status) => {
    expect(isRetryableError(new HttpError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404])('does not retry HTTP %i', (status) => {
    expect(isRetryableError(new HttpError(status))).toBe(false);
  });

  it('retries by message for UNAVAILABLE and network failures', () => {
    expect(isRetryableError(new Error('{"error":{"status":"UNAVAILABLE"}}'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('does not retry validation or invalid argument errors', () => {
    expect(isRetryableError(new Error('INVALID_ARGUMENT: bad schema'))).toBe(false);
    expect(isRetryableError(new Error('zod validation failed'))).toBe(false);
  });

  it('retries timeouts', () => {
    expect(isRetryableError(new TimeoutError(100))).toBe(true);
    expect(classifyError(new TimeoutError(100))).toBe('timeout');
  });
});

describe('computeBackoffMs', () => {
  it('grows exponentially and stays within the jitter band', () => {
    expect(computeBackoffMs(0, 500, 4000, () => 0)).toBe(250);
    expect(computeBackoffMs(0, 500, 4000, () => 0.999)).toBeLessThanOrEqual(500);
    expect(computeBackoffMs(2, 500, 4000, () => 0)).toBe(1000);
  });

  it('never exceeds the cap', () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect(computeBackoffMs(attempt, 500, 4000, () => 0.999)).toBeLessThanOrEqual(4000);
    }
  });
});

describe('runWithRetry', () => {
  it('retries a 503 and succeeds on the second attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new HttpError(503)).mockResolvedValueOnce('done');
    const { result, attempts } = await runWithRetry(fn, { retries: 2, timeoutMs: 1000, sleep: noSleep });
    expect(result).toEqual({ ok: true, data: 'done' });
    expect(attempts).toBe(2);
  });

  it('does not retry a 400', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(400));
    const { result, attempts } = await runWithRetry(fn, { retries: 2, timeoutMs: 1000, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops after retries + 1 attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(503));
    const { attempts } = await runWithRetry(fn, { retries: 2, timeoutMs: 1000, sleep: noSleep });
    expect(attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('sleeps with bounded backoff between attempts', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue(new HttpError(429));
    await runWithRetry(fn, { retries: 2, timeoutMs: 1000, sleep, baseDelayMs: 500, maxDelayMs: 4000, random: () => 0.5 });
    expect(sleep).toHaveBeenCalledTimes(2);
    for (const [ms] of sleep.mock.calls) {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(4000);
    }
  });

  it('aborts and reports a timeout when the call hangs', async () => {
    let received: AbortSignal | undefined;
    const fn = (signal: AbortSignal) => {
      received = signal;
      return new Promise<string>(() => undefined);
    };
    const { result, attempts } = await runWithRetry(fn, { retries: 0, timeoutMs: 20, sleep: noSleep });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.timedOut).toBe(true);
    expect(attempts).toBe(1);
    expect(received?.aborted).toBe(true);
  });

  it('retries after a timeout when retries remain', async () => {
    const fn = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>(() => undefined))
      .mockResolvedValueOnce('late');
    const { result, attempts } = await runWithRetry(fn, { retries: 1, timeoutMs: 20, sleep: noSleep });
    expect(result).toEqual({ ok: true, data: 'late' });
    expect(attempts).toBe(2);
  });
});
