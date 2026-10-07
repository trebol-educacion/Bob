import { describe, it, expect, vi, beforeEach } from 'vitest';

const completeMock = vi.fn();
const geminiMock = vi.fn();
vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'u1' }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: async () => 'prompt' }));
vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...a: unknown[]) => geminiMock(...a),
  isOk: (r: { ok: boolean }) => r.ok,
}));

import { evaluateEmailAction } from '@/actions/modes/writing-email';
import { restoreOpenWriting } from '@/lib/writing/open-writing-restore';

const input = {
  text: 'hello world',
  exam_part: 'toefl_writing_email',
  instructions: 'write',
  targetWordCount: [80, 100] as [number, number],
};

function reply(json: unknown) {
  return { ok: true, data: { candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] } };
}

beforeEach(() => {
  completeMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 7.5 } });
  geminiMock.mockReset();
});

describe('evaluateEmailAction', () => {
  it('creates the session only after a rubric-graded evaluation', async () => {
    geminiMock.mockResolvedValue(
      reply({ understood: true, highlights: ['a'], suggestions: ['b'], rubric: { task_coverage: 3, grammar: 3, vocabulary: 3, fluency: 3 } }),
    );
    const outcome = await evaluateEmailAction(input);
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'toefl_writing_email',
        evaluation: expect.objectContaining({ rubric: { task_coverage: 3, grammar: 3, vocabulary: 3, fluency: 3 } }),
      }),
    );
    expect(outcome).toMatchObject({ sessionId: 's1', feedback: { kind: 'writing_formative' } });
  });

  it('does not create a session when the evaluation fails or lacks a rubric', async () => {
    geminiMock.mockResolvedValue({ ok: false, error: 'x' });
    expect(await evaluateEmailAction(input)).toEqual({ error: 'evaluation_failed' });
    geminiMock.mockResolvedValue(reply({ understood: true, highlights: [], suggestions: [] }));
    expect(await evaluateEmailAction(input)).toEqual({ error: 'evaluation_unparseable' });
    expect(completeMock).not.toHaveBeenCalled();
  });
});

describe('restoreOpenWriting', () => {
  it('rebuilds text and feedback from the history', () => {
    const restored = restoreOpenWriting([
      { role: 'bob', msg_type: 'text', content_json: { kind: 'writing_prompt', instructions: 'write' } },
      { role: 'user', msg_type: 'text', content_json: { kind: 'writing_submission', text: 'hello' } },
      {
        role: 'bob',
        msg_type: 'evaluation',
        content_json: {
          kind: 'writing_formative',
          understood: true,
          highlights: ['a'],
          suggestions: [],
          indicators: { word_count: 1, target_word_count_range: [80, 100] },
          is_final: true,
        },
      },
    ]);
    expect(restored?.text).toBe('hello');
    expect(restored?.feedback.highlights).toEqual(['a']);
  });

  it('returns null while the session has no final evaluation', () => {
    expect(restoreOpenWriting([{ role: 'user', msg_type: 'text', content_json: { kind: 'writing_submission', text: 'x' } }])).toBeNull();
  });
});
