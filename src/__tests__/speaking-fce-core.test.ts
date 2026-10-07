import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const callGemini = vi.fn();
vi.mock('@/lib/gemini-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gemini-client')>('@/lib/gemini-client');
  return { ...actual, callGemini: (...args: unknown[]) => callGemini(...args) };
});

const getPrompt = vi.fn();
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: (...args: unknown[]) => getPrompt(...args) }));

const openSession = vi.fn();
const recordTurn = vi.fn();
const finishSession = vi.fn();
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: (...args: unknown[]) => openSession(...args),
  recordTurn: (...args: unknown[]) => recordTurn(...args),
  finishSession: (...args: unknown[]) => finishSession(...args),
}));

const getOrCreateCachedContent = vi.fn();
vi.mock('@/lib/cache', () => ({
  getOrCreateCachedContent: (...args: unknown[]) => getOrCreateCachedContent(...args),
}));


import {
  evaluateQuestionRound,
  generateQuestionRoundPlan,
  processQuestionRoundAnswer,
} from '@/lib/speaking/question-round';
import { chatCollaborativeAudio, chatCollaborativeText, evaluateCollaborative } from '@/lib/speaking/collaborative';
import {
  FCE_COLLABORATIVE_CONFIG,
  FCE_DISCUSSION_CONFIG,
  FCE_INTERVIEW_CONFIG,
} from '@/lib/speaking/fce-configs';

const evalJson = JSON.stringify({
  score: 15,
  score_max: 20,
  cefr_band: 'b2',
  band_per_criterion: {
    grammar_and_vocabulary: 4,
    pronunciation: 3,
    interactive_communication: 4,
    discourse_management: 3,
  },
  feedback: 'Solid B2 performance.',
  model_answer: 'I would say that',
});

const scenario = {
  topic: 'Transport',
  situation: 'script',
  prompt_question: 'Which is best?',
  options: ['a', 'b', 'c', 'd', 'e'],
};

beforeEach(() => {
  vi.clearAllMocks();
  getPrompt.mockResolvedValue('PROMPT');
  openSession.mockResolvedValue({ ok: true, data: { sessionId: 's1', userId: 'u1' } });
  recordTurn.mockResolvedValue({ ok: true, data: { ids: [] } });
  finishSession.mockResolvedValue({ ok: true, data: { score10: 7, messageId: 'm1' } });
});

describe('FCE question round (P1 and P4)', () => {
  it('persists a final evaluation with score, score_max and the derived grade', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: evalJson } });
    const result = await evaluateQuestionRound(FCE_INTERVIEW_CONFIG, [{ question: 'Q1', answer: 'A1' }], {
      sessionId: 's1',
      plan: FCE_INTERVIEW_CONFIG.planFallback,
    });
    if (!result.ok) throw new Error(result.code);

    expect(result.data.feedback.score10).toBe(7);
    expect(getPrompt).toHaveBeenCalledWith('cambridge_fce_p1_b2_evaluation');
    expect(finishSession.mock.calls[0][0].evaluation).toMatchObject({ score: 14, score_max: 20, score10: 7 });
  });

  it('does not persist a fake evaluation when the model reply is invalid', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: '{"nope":1}' } });
    const result = await evaluateQuestionRound(FCE_DISCUSSION_CONFIG, [{ question: 'Q', answer: 'A' }], {
      sessionId: 's1',
      plan: FCE_DISCUSSION_CONFIG.planFallback,
    });
    if (!result.ok) throw new Error(result.code);
    expect(result.data.feedback.score10).toBeUndefined();
    expect(result.data.feedback.suggestions.length).toBeGreaterThan(0);
    expect(finishSession).not.toHaveBeenCalled();
  });

  it('skips the examiner reaction and uses the FCE transcribe prompt', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: '{"transcript":"hello there"}' } });
    const result = await processQuestionRoundAnswer(FCE_INTERVIEW_CONFIG, 'b64', 'audio/webm', 'Q', {
      sessionId: 's1',
      plan: FCE_INTERVIEW_CONFIG.planFallback,
    });
    expect(result).toEqual({ ok: true, data: { transcribed: 'hello there', reaction: '', sessionId: 's1' } });
    expect(recordTurn.mock.calls[0][0].messages[0]).toMatchObject({ role: 'user', contentText: 'hello there' });
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(getPrompt).toHaveBeenCalledWith('cambridge_fce_p1_b2_transcribe');
  });

  it('keys the plan cache by the linked topic and passes it to the prompt', async () => {
    getOrCreateCachedContent.mockImplementation(async (_key: unknown, producer: () => Promise<{ ok: boolean; data?: unknown; code?: string }>) => {
      const produced = await producer();
      return produced.ok ? produced.data : { error: produced.code };
    });
    callGemini.mockResolvedValue({ ok: true, data: { text: '{"discussion_questions":["q1","q2","q3"]}' } });
    const plan = await generateQuestionRoundPlan(FCE_DISCUSSION_CONFIG, 'u1', { TOPIC: 'Transport' });

    expect(plan).toEqual({ discussion_questions: ['q1', 'q2', 'q3'] });
    expect(getOrCreateCachedContent.mock.calls[0][0]).toMatchObject({ inputs: { TOPIC: 'Transport' } });
    expect(getPrompt).toHaveBeenCalledWith('cambridge_fce_p4_b2_generation', { TOPIC: 'Transport' });
  });
});

describe('FCE collaborative (P3)', () => {
  it('reads the evaluation prompt from the database and persists the graded result', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: evalJson } });
    const result = await evaluateCollaborative(
      FCE_COLLABORATIVE_CONFIG,
      [{ role: 'user', text: 'I think the first idea is best.' }],
      scenario,
      's1',
    );
    if (!result.ok) throw new Error(result.code);

    expect(getPrompt).toHaveBeenCalledWith('cambridge_fce_p3_b2_evaluation', expect.objectContaining({ TOPIC: 'Transport' }));
    expect(result.data.feedback.score10).toBe(7);
    expect(finishSession.mock.calls[0][0].evaluation).toMatchObject({ score: 14, score_max: 20 });
  });

  it('passes the turn number to the partner prompt and unwraps a JSON text reply', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: '{"partner_turn":"What about the second idea?"}' } });
    const result = await chatCollaborativeText(
      FCE_COLLABORATIVE_CONFIG,
      'I like the first one',
      [{ role: 'examiner', text: 'open' }, { role: 'user', text: 'x' }, { role: 'examiner', text: 'y' }],
      scenario,
      's1',
    );

    if (!result.ok) throw new Error(result.code);
    expect(result.data.examinerResponse).toBe('What about the second idea?');
    expect(getPrompt).toHaveBeenCalledWith('cambridge_fce_p3_b2_partner_turn', expect.objectContaining({ TURN_INDEX: '2' }));
  });

  it('returns the transcription and the examiner line for an audio turn', async () => {
    callGemini.mockResolvedValue({
      ok: true,
      data: { text: '{"transcribed":"I prefer cheaper tickets","examiner_response":"Why is that?"}' },
    });
    const result = await chatCollaborativeAudio(FCE_COLLABORATIVE_CONFIG, 'b64', 'audio/webm', [], scenario, 's1');
    expect(result).toEqual({
      ok: true,
      data: { transcribed: 'I prefer cheaper tickets', examinerResponse: 'Why is that?', sessionId: 's1' },
    });
  });

  it('creates the session on the first turn with scenario and opening, never before', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: '{"partner_turn":"Go on."}' } });
    await chatCollaborativeText(FCE_COLLABORATIVE_CONFIG, 'hi', [{ role: 'examiner', text: 'open' }], scenario);
    const opening = openSession.mock.calls[0][0];
    expect(opening).toMatchObject({ mode: 'cambridge_fce_p3', sessionId: undefined, topic: 'Transport' });
    expect(opening.opening.map((m: { msgType: string }) => m.msgType)).toEqual(['phrase', 'text']);
  });
});
