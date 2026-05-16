vi.mock('server-only', () => ({}));

class MockGoogleGenAI {
  models = {};
}

vi.mock('@google/genai', () => ({
  GoogleGenAI: MockGoogleGenAI,
}));

process.env.GEMINI_API_KEY = 'test-key';

describe('callGemini — fallback on error', () => {
  it('returns ok:false and captures error message when the fn throws', async () => {
    const { callGemini } = await import('@/lib/gemini-client');

    const result = await callGemini(
      { promptKey: 'test', model: 'gemini-2.0-flash', userId: 'u1' },
      async () => {
        throw new Error('network error');
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('network error');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('records a non-negative latencyMs on success', async () => {
    const { callGemini } = await import('@/lib/gemini-client');

    const result = await callGemini(
      { promptKey: 'test', model: 'gemini-2.0-flash' },
      async () => 'pong'
    );

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
