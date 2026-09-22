import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prompts/db-prompts', () => ({
  getPrompt: vi.fn().mockResolvedValue('mock prompt'),
}));

const callGeminiMock = vi.fn();
vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...args: unknown[]) => callGeminiMock(...args),
}));

import { checkTopicIsAppropriateAction } from '@/actions/gemini/topic-guard';

describe('checkTopicIsAppropriateAction (T7.9)', () => {
  beforeEach(() => {
    callGeminiMock.mockReset();
  });

  it('blocks a topic the model flags as not appropriate', async () => {
    callGeminiMock.mockResolvedValue({
      ok: true,
      data: { text: JSON.stringify({ appropriate: false, reason: 'unsafe' }) },
      latencyMs: 1,
    });

    const result = await checkTopicIsAppropriateAction('something unsafe');
    expect(result.appropriate).toBe(false);
  });

  it('allows a topic the model flags as appropriate', async () => {
    callGeminiMock.mockResolvedValue({
      ok: true,
      data: { text: JSON.stringify({ appropriate: true }) },
      latencyMs: 1,
    });

    const result = await checkTopicIsAppropriateAction('shopping for groceries');
    expect(result.appropriate).toBe(true);
  });

  it('fails open (appropriate: true) when Gemini errors', async () => {
    callGeminiMock.mockResolvedValue({ ok: false, error: 'boom', latencyMs: 1 });

    const result = await checkTopicIsAppropriateAction('holidays');
    expect(result.appropriate).toBe(true);
  });

  it('fails open when the response is not valid JSON', async () => {
    callGeminiMock.mockResolvedValue({ ok: true, data: { text: 'not json' }, latencyMs: 1 });

    const result = await checkTopicIsAppropriateAction('holidays');
    expect(result.appropriate).toBe(true);
  });
});
