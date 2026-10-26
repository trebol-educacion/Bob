import { beforeEach, describe, expect, it, vi } from 'vitest';

const pickPlan = vi.fn();
const loadPlan = vi.fn();
const completeActivity = vi.fn();

vi.mock('@/lib/item-bank/plan-bank', () => ({
  pickPlan: (...a: unknown[]) => pickPlan(...a),
  loadPlan: (...a: unknown[]) => loadPlan(...a),
  bankStamp: (examPart: string, groupId: string | null | undefined) => ({ exam_part: examPart, bank_group_id: groupId ?? null }),
}));
vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeActivity(...a) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'u1' }));

import { startOfficialListeningAction, submitOfficialListeningAction } from '@/actions/modes/toefl-official-listening';
import { answersOfResult } from '@/components/practice/toefl-listening/official-listening-api';
import { ToeflOfficialListeningPlanSchema, type OfficialListeningPart, type ToeflOfficialListeningPlan } from '@/lib/bank-plans/toefl-official-listening';
import { restoreGroupSession } from '@/lib/item-bank/group-restore';
import type { GroupExercisePayload } from '@/lib/item-bank/group-types';
import { modeKeyOf } from '@/lib/organization/catalog';
import {
  gradeOfficialListening,
  officialQuestionId,
  toOfficialListeningExercise,
  type OfficialListeningResult,
} from '@/lib/toefl/official-listening-bank';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

function question(number: number, key: (typeof LETTERS)[number]) {
  return {
    number,
    question: `Question ${number}?`,
    options: LETTERS.map((letter) => ({ key: letter, label: `Option ${letter}` })),
    correct_key: key,
  };
}

const TALK: ToeflOfficialListeningPlan = {
  directions: 'Listen to a talk in an environmental science class.',
  audio_url: '/toefl/official/academic-talk/m2-q13-16.mp3',
  transcript: 'Professor: An ecological footprint is a measure of the environmental impact.',
  questions: [question(13, 'B'), question(14, 'C'), question(15, 'D'), question(16, 'A')],
};

const PART: OfficialListeningPart = 'toefl_listening_academic_talk';

beforeEach(() => {
  pickPlan.mockReset();
  loadPlan.mockReset();
  completeActivity.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 7.5 } });
});

describe('official TOEFL listening bank', () => {
  it('accepts the stored plan shape and rejects a plan without keys', () => {
    expect(ToeflOfficialListeningPlanSchema.safeParse(TALK).success).toBe(true);
    const withoutKey = { ...TALK, questions: [{ ...question(13, 'B'), correct_key: undefined }] };
    expect(ToeflOfficialListeningPlanSchema.safeParse(withoutKey).success).toBe(false);
  });

  it('serves the exercise with official numbering and without keys nor transcript', () => {
    const exercise = toOfficialListeningExercise(TALK, 'g1');
    expect(exercise.questions.map((entry) => entry.number)).toEqual([13, 14, 15, 16]);
    expect(exercise.questions[0].id).toBe('g1-q13');
    expect(exercise.audioUrl).toBe(TALK.audio_url);
    const serialized = JSON.stringify(exercise);
    expect(serialized).not.toContain('correct_key');
    expect(serialized).not.toContain(TALK.transcript);
  });

  it('grades against the official keys into a 0-10 score and reveals the transcript', () => {
    const answers = {
      [officialQuestionId('g1', 13)]: 'b',
      [officialQuestionId('g1', 14)]: 'C',
      [officialQuestionId('g1', 15)]: 'A',
    };
    const result = gradeOfficialListening(TALK, 'g1', answers);
    expect(result.correct).toBe(2);
    expect(result.total).toBe(4);
    expect(result.score_10).toBe(5);
    expect(result.results.map((entry) => entry.is_correct)).toEqual([true, true, false, false]);
    expect(result.results[3].given).toBe('');
    expect(result.transcript).toBe(TALK.transcript);
    expect(answersOfResult(result)).toEqual({ 'g1-q13': 'B', 'g1-q14': 'C', 'g1-q15': 'A', 'g1-q16': '' });
  });

  it('gives 10 only when every official key is matched', () => {
    const answers = Object.fromEntries(TALK.questions.map((entry) => [officialQuestionId('g1', entry.number), entry.correct_key]));
    expect(gradeOfficialListening(TALK, 'g1', answers).score_10).toBe(10);
  });
});

describe('official TOEFL listening actions', () => {
  it('reads one published group of the part from the bank, with no model call', async () => {
    pickPlan.mockResolvedValue({ ok: true, data: { plan: TALK, groupId: 'g1' } });
    const outcome = await startOfficialListeningAction(PART);
    expect(pickPlan).toHaveBeenCalledWith(expect.objectContaining({ exam: 'toefl', examPart: PART, skill: 'listening', userId: 'u1' }));
    expect(outcome).toMatchObject({ exercise: { groupId: 'g1' } });
  });

  it('returns a clear error instead of throwing when the bank has no group', async () => {
    pickPlan.mockResolvedValue({ ok: false, code: 'no_content' });
    await expect(startOfficialListeningAction(PART)).resolves.toEqual({ error: 'No exercise available' });
  });

  it('rejects parts outside the official listening set', async () => {
    const outcome = await startOfficialListeningAction('toefl_listen_choose_response' as OfficialListeningPart);
    expect(outcome).toEqual({ error: 'No exercise available' });
    expect(pickPlan).not.toHaveBeenCalled();
  });

  it('grades on the server and persists plan, answers and a restorable final evaluation', async () => {
    loadPlan.mockResolvedValue({ ok: true, data: TALK });
    const answers = { 'g1-q13': 'B', 'g1-q14': 'C', 'g1-q15': 'D', 'g1-q16': 'B' };
    const outcome = await submitOfficialListeningAction(PART, { groupId: 'g1', answers });
    expect(outcome).toMatchObject({ sessionId: 's1', result: { correct: 3, total: 4 } });

    const saved = completeActivity.mock.calls[0][0];
    expect(saved.mode).toBe(PART);
    expect(saved.bank).toEqual({ exam_part: PART, bank_group_id: 'g1' });
    expect(saved.evaluation).toMatchObject({ exam_part: PART, score: 3, score_max: 4, score_10: 7.5 });

    const messages = [
      { role: 'bob', content_json: { ...saved.plan, ...saved.bank } },
      { role: 'user', content_json: saved.answers[0] },
      { role: 'bob', content_json: { ...saved.evaluation, is_final: true } },
    ];
    const restored = restoreGroupSession<GroupExercisePayload, OfficialListeningResult>(messages, PART);
    expect(restored?.exercise.groupId).toBe('g1');
    expect(restored?.result?.correct).toBe(3);
    expect(JSON.stringify(saved.plan)).not.toContain('correct_key');
  });

  it('reports a save error when the plan of the group cannot be read', async () => {
    loadPlan.mockResolvedValue({ ok: false, code: 'no_content' });
    await expect(submitOfficialListeningAction(PART, { groupId: 'gone', answers: {} })).resolves.toEqual({ error: 'Could not load exercise' });
    expect(completeActivity).not.toHaveBeenCalled();
  });
});

describe('catalog mode key', () => {
  it('does not double the framework prefix of TOEFL exam parts', () => {
    expect(modeKeyOf('toefl', 'toefl_listening_conversation')).toBe('toefl_listening_conversation');
    expect(modeKeyOf('toefl', 'listen_choose_response')).toBe('toefl_listen_choose_response');
    expect(modeKeyOf('cambridge', 'pet_listening_part2')).toBe('cambridge_pet_listening_part2');
  });
});
