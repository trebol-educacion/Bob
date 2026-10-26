vi.mock('server-only', () => ({}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchPracticeTopics = vi.fn();

vi.mock('@/lib/practice/topics-repository', () => ({
  fetchPracticeTopics: (...args: unknown[]) => fetchPracticeTopics(...args),
}));

import { MODE_PROMPT_KEY, parsePracticeSessionMode } from '@/lib/practice/mode-prompt-key';
import { MODE_TURN_PROMPT_KEY } from '@/lib/practice/turn-prompts';
import { pickPracticeSeed } from '@/lib/practice/seed';
import { preparePracticeAction } from '@/actions/practice/start';
import { restorePractice } from '@/lib/practice/messages';

describe('modo presentation', () => {
  beforeEach(() => fetchPracticeTopics.mockReset());

  it('tiene prompt inicial y prompt de turno propios', () => {
    expect(MODE_PROMPT_KEY.presentation).toBe('practice_presentation_shared_initial');
    expect(MODE_TURN_PROMPT_KEY.presentation).toBe('practice_presentation_shared_eval_turn');
  });

  it('la sesion practice_presentation se reabre como presentation', () => {
    expect(parsePracticeSessionMode('practice_presentation')).toBe('presentation');
  });

  it('sin tema elegido saca un tema de presentacion aleatorio', () => {
    const seed = pickPracticeSeed('presentation', () => 0);
    expect(seed.topic).toBe('your favourite way to spend a free weekend');
  });

  it('acepta el topic elegido igual que conversation', async () => {
    fetchPracticeTopics.mockResolvedValue([
      { slug: 'travel_tourism', areaSlug: 'leisure_travel', areaOrder: 3, sortOrder: 1, minCefrLevel: 'pre_a1', promptDescription: 'travelling and tourism' },
    ]);
    const result = await preparePracticeAction({
      mode: 'presentation',
      skillLevels: null,
      cefrActiveLevel: 'b1',
      topicSlug: 'travel_tourism',
    });
    expect(result.ok && result.data.seed.topic).toBe('travelling and tourism');
  });

  it('situation y picture siguen rechazando un topic', async () => {
    const result = await preparePracticeAction({ mode: 'picture', skillLevels: null, cefrActiveLevel: 'b1', topicSlug: 'x' });
    expect(result).toMatchObject({ ok: false, code: 'invalid_topic' });
  });

  it('sin topic prepara un seed aleatorio de presentation', async () => {
    const result = await preparePracticeAction({ mode: 'presentation', skillLevels: null, cefrActiveLevel: 'a2' });
    expect(result.ok && result.data.mode).toBe('presentation');
    expect(fetchPracticeTopics).not.toHaveBeenCalled();
  });
});

describe('compatibilidad de sesiones antiguas', () => {
  it('rubric_detail antiguo se restaura con sus cuatro campos originales', () => {
    const detail = { participation: 5, fluency: 6, independence: 7, comprehension: 8 };
    const restored = restorePractice([
      { role: 'bob', msg_type: 'evaluation', content_json: { kind: 'practice_result', score_10: 6.4, rubric_detail: detail, feedback: 'ok' } },
    ]);
    expect(restored.result?.detail).toEqual(detail);
  });

  it('rubric_detail nuevo con pronunciacion sin valorar se restaura tal cual', () => {
    const detail = { pronunciation: null, fluency: 6, grammar: 7, vocabulary: 8 };
    const restored = restorePractice([
      { role: 'bob', msg_type: 'evaluation', content_json: { kind: 'practice_result', score_10: 7, rubric_detail: detail, feedback: 'ok' } },
    ]);
    expect(restored.result?.detail).toEqual(detail);
  });

  it('los criterios guardados en un turno de alumno se recuperan en la senal', () => {
    const criteria = { pronunciation: 3, fluency: 4, grammar: 2, vocabulary: 5 };
    const restored = restorePractice([
      { role: 'user', msg_type: 'text', content_text: 'hi', content_json: { kind: 'practice_student', hasAudio: true, hintUsed: false, modelAnswerUsed: false, turnScore: 70, criteria } },
    ]);
    expect(restored.turnSignals[0].criteria).toEqual(criteria);
  });
});
