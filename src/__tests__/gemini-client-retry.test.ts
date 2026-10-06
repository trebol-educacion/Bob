vi.mock('server-only', () => ({}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {};
  },
}));

process.env.GEMINI_API_KEY = 'test-key';

class HttpError extends Error {
  constructor(public status: number) {
    super(`status ${status}`);
  }
}

describe('callGemini retry policy', () => {
  it('retries a 503 and returns the data', async () => {
    const { callGemini } = await import('@/lib/gemini-client');
    const fn = vi.fn().mockRejectedValueOnce(new HttpError(503)).mockResolvedValueOnce('pong');
    const result = await callGemini({ promptKey: 't', model: 'gemini-2.5-flash', retries: 2, timeoutMs: 1000 }, fn);
    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400 and reports it as permanent', async () => {
    const { callGemini } = await import('@/lib/gemini-client');
    const fn = vi.fn().mockRejectedValue(new HttpError(400));
    const result = await callGemini({ promptKey: 't', model: 'gemini-2.5-flash', retries: 2, timeoutMs: 1000 }, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.code).toBe('http_400');
    }
  });

  it('reports a timeout as retryable', async () => {
    const { callGemini } = await import('@/lib/gemini-client');
    const fn = vi.fn(() => new Promise<string>(() => undefined));
    const result = await callGemini({ promptKey: 't', model: 'gemini-2.5-flash', retries: 0, timeoutMs: 20 }, fn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('timeout');
      expect(result.retryable).toBe(true);
    }
  });

  it('passes an AbortSignal to the call', async () => {
    const { callGemini } = await import('@/lib/gemini-client');
    const fn = vi.fn(async (_ai: unknown, signal: AbortSignal) => signal.aborted);
    const result = await callGemini({ promptKey: 't', model: 'gemini-2.5-flash' }, fn);
    expect(result.ok && result.data).toBe(false);
  });

  it('uses longer default timeouts for tts and image models', async () => {
    const { defaultTimeoutMs } = await import('@/lib/gemini-client');
    expect(defaultTimeoutMs('gemini-2.5-flash')).toBe(25_000);
    expect(defaultTimeoutMs('gemini-2.5-flash-preview-tts')).toBe(60_000);
    expect(defaultTimeoutMs('gemini-2.5-flash-image')).toBe(60_000);
  });
});

describe('streamGemini retry policy', () => {
  it('retries opening the stream on a 503', async () => {
    const { streamGemini } = await import('@/lib/gemini-client');
    async function* chunks() {
      yield { text: 'hi' };
    }
    const fn = vi.fn().mockRejectedValueOnce(new HttpError(503)).mockResolvedValueOnce(chunks());
    const result = await streamGemini({ promptKey: 't', model: 'gemini-2.5-flash-lite' }, fn);
    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
