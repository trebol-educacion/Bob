vi.mock('server-only', () => ({}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.fn();
const getPrompt = vi.fn();

vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...args: unknown[]) => callGemini(...args),
}));

vi.mock('@/lib/prompts/db-prompts', () => ({
  getPrompt: (...args: unknown[]) => getPrompt(...args),
}));

import { practiceChatAudioAction, practiceChatTextAction } from '@/actions/practice/chat';

function modelReply(criteria: unknown) {
  return {
    ok: true,
    data: {
      text: JSON.stringify({
        evaluation: { score: 70, feedback: 'Good', transcribed_text: 'I like football', criteria },
        ai_response: 'Nice! Why?',
      }),
    },
  };
}

describe('practiceChat actions', () => {
  beforeEach(() => {
    callGemini.mockReset();
    getPrompt.mockReset().mockResolvedValue('PROMPT');
  });

  it('el turno de audio devuelve las cuatro bandas incluida la pronunciacion', async () => {
    callGemini.mockResolvedValue(modelReply({ pronunciation: 3, fluency: 4, grammar: 2, vocabulary: 5 }));
    const result = await practiceChatAudioAction('b64', 'audio/webm', [], 'travel', 'b1', 'conversation');
    expect(result.criteria).toEqual({ pronunciation: 3, fluency: 4, grammar: 2, vocabulary: 5 });
    expect(getPrompt).toHaveBeenCalledWith('practice_shared_eval_turn', { TOPIC: 'travel', CEFR_LEVEL: 'b1' });
  });

  it('el turno de texto fuerza la pronunciacion a null aunque el modelo la rellene', async () => {
    callGemini.mockResolvedValue(modelReply({ pronunciation: 5, fluency: 4, grammar: 4, vocabulary: 4 }));
    const result = await practiceChatTextAction('I like football', [], 'sports', 'a2', 'situation');
    expect(result.criteria?.pronunciation).toBeNull();
    expect(result.evaluation.transcribed_text).toBe('I like football');
  });

  it('el texto del alumno viaja al modelo junto al prompt', async () => {
    callGemini.mockResolvedValue(modelReply({ pronunciation: null, fluency: 3, grammar: 3, vocabulary: 3 }));
    await practiceChatTextAction('Hello there', [{ role: 'model', text: 'Hi' }], 'x', 'a1', 'conversation');
    const call = callGemini.mock.calls[0];
    const run = call[1] as (ai: unknown) => Promise<unknown>;
    const generateContent = vi.fn().mockResolvedValue({});
    await run({ models: { generateContent } });
    const contents = generateContent.mock.calls[0][0].contents as Array<{ parts: Array<{ text?: string }> }>;
    expect(contents[contents.length - 1].parts.map((p) => p.text)).toEqual(['Hello there', 'PROMPT']);
  });

  it('presentation usa su propio prompt de turno', async () => {
    callGemini.mockResolvedValue(modelReply({ pronunciation: 3, fluency: 3, grammar: 3, vocabulary: 3 }));
    await practiceChatAudioAction('b64', 'audio/webm', [], 'my hobby', 'b1', 'presentation');
    expect(getPrompt).toHaveBeenCalledWith('practice_presentation_shared_eval_turn', expect.any(Object));
  });

  it('si el prompt nuevo aun no esta en la BD cae al prompt antiguo sin criterios', async () => {
    getPrompt.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce('LEGACY');
    callGemini.mockResolvedValue(modelReply(undefined));
    const result = await practiceChatAudioAction('b64', 'audio/webm', [], 'x', 'b1', 'conversation');
    expect(getPrompt).toHaveBeenLastCalledWith('generic_conversation_shared_eval_audio', expect.any(Object));
    expect(result.criteria).toBeNull();
    expect(result.ai_response).toBe('Nice! Why?');
  });

  it('una respuesta invalida del modelo devuelve el turno de fallback sin criterios', async () => {
    callGemini.mockResolvedValue({ ok: true, data: { text: 'not json at all' } });
    const result = await practiceChatTextAction('hi', [], 'x', 'b1', 'conversation');
    expect(result.criteria).toBeNull();
    expect(result.evaluation.score).toBe(0);
  });

  it('un fallo de Gemini devuelve el fallback', async () => {
    callGemini.mockResolvedValue({ ok: false, error: 'x', retryable: true, code: 'e', attempts: 1, latencyMs: 1 });
    const result = await practiceChatAudioAction('b64', 'audio/webm', [], 'x', 'b1', 'conversation');
    expect(result.criteria).toBeNull();
  });
});
