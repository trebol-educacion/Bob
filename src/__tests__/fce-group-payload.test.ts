import { describe, it, expect } from 'vitest';
import { toGroupPayload } from '@/lib/item-bank/group-payload';
import { matchesAcceptedText, matchesLetterKey, gradeGroupAnswers, scoreOutOfTen } from '@/lib/item-bank/group-grading';
import { restoreGroupSession } from '@/lib/item-bank/group-restore';
import { GROUP_EVALUATION_KIND, GROUP_PLAN_KIND } from '@/lib/item-bank/group-session-types';
import { inferSkillFromMode } from '@/lib/skill-from-mode';
import {
  L2_GROUP, L2_ITEMS, L3_GROUP, L3_ITEMS, L4_GROUP, L4_ITEMS, R7_GROUP, R7_ITEMS,
  SECRET_EXPLANATION, SECRET_TRANSCRIPT,
} from './fce-group-fixtures';

const CASES = [
  ['R7', R7_GROUP, R7_ITEMS],
  ['L2', L2_GROUP, L2_ITEMS],
  ['L3', L3_GROUP, L3_ITEMS],
  ['L4', L4_GROUP, L4_ITEMS],
] as const;

describe('toGroupPayload no expone clave ni transcript', () => {
  it.each(CASES)('%s', (_name, group, items) => {
    const serialized = JSON.stringify(toGroupPayload(group, [...items]));
    expect(serialized).not.toContain(SECRET_TRANSCRIPT);
    expect(serialized).not.toContain(SECRET_EXPLANATION);
    expect(serialized).not.toContain('correct_key');
    expect(serialized).not.toContain('accepted');
    expect(serialized).not.toContain('vesuvius');
  });

  it('R7: cuatro secciones con texto, 10 preguntas numeradas 43-52', () => {
    const payload = toGroupPayload(R7_GROUP, [...R7_ITEMS].reverse());
    expect(payload.choices).toHaveLength(4);
    expect(payload.choices[0].text).toContain('sustainable living journey');
    expect(payload.questions.map((q) => q.number)).toEqual([43, 44, 45, 46, 47, 48, 49, 50, 51, 52]);
  });

  it('L3: ocho opciones A-H y un clip por hablante', () => {
    const payload = toGroupPayload(L3_GROUP, L3_ITEMS);
    expect(payload.choices.map((c) => c.key)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(payload.questions).toHaveLength(5);
    expect(payload.questions[0].audioUrl).toBe('/fce-listening-part3/gen-l3-001-s1.wav');
  });

  it('L2 y L4: audio en el grupo', () => {
    expect(toGroupPayload(L2_GROUP, L2_ITEMS).audioUrl).toBe('/fce-listening-part2/gen-l2-001.wav');
    const l4 = toGroupPayload(L4_GROUP, L4_ITEMS);
    expect(l4.audioUrl).toBe('/fce-listening-part4/gen-l4-001.wav');
    expect(l4.questions[0].options.map((o) => o.key)).toEqual(['A', 'B', 'C']);
  });
});

describe('gradeGroupAnswers', () => {
  it('matching admite respuestas repetidas y calcula nota 0-10 determinista', () => {
    const answers = Object.fromEntries(R7_ITEMS.map((item) => [item.id, 'A']));
    const graded = gradeGroupAnswers(R7_ITEMS, answers, matchesLetterKey);
    expect(graded.correct).toBe(3);
    expect(graded.total).toBe(10);
    expect(graded.score_10).toBe(3);
  });

  it('todo correcto da 10 y sin responder da 0', () => {
    const all = Object.fromEntries(L3_ITEMS.map((item) => [item.id, item.correct_key]));
    expect(gradeGroupAnswers(L3_ITEMS, all, matchesLetterKey).score_10).toBe(10);
    const none = gradeGroupAnswers(L3_ITEMS, {}, matchesLetterKey);
    expect(none.correct).toBe(0);
    expect(none.score_10).toBe(0);
  });

  it('letra en minusculas se acepta', () => {
    const graded = gradeGroupAnswers(L4_ITEMS, { 'l4-item-1': 'b', 'l4-item-2': 'A', 'l4-item-3': 'C' }, matchesLetterKey);
    expect(graded.results.map((r) => r.is_correct)).toEqual([true, false, true]);
    expect(graded.score_10).toBe(6.7);
  });

  it('respuesta abierta acepta accepted[] sin distinguir mayusculas ni espacios', () => {
    const graded = gradeGroupAnswers(
      L2_ITEMS,
      { 'l2-item-1': '  Vesuvius ', 'l2-item-2': 'AD 79', 'l2-item-3': 'three' },
      matchesAcceptedText,
    );
    expect(graded.results.map((r) => r.is_correct)).toEqual([true, true, false]);
    expect(graded.correct).toBe(2);
  });

  it('scoreOutOfTen con total 0', () => {
    expect(scoreOutOfTen(0, 0)).toBe(0);
  });
});

describe('restoreGroupSession', () => {
  const exercise = toGroupPayload(L4_GROUP, L4_ITEMS);

  it('devuelve el ejercicio sin resultado si no se envio', () => {
    const restored = restoreGroupSession([{ role: 'bob', content_json: { kind: GROUP_PLAN_KIND, exercise } }]);
    expect(restored?.exercise.groupId).toBe('l4-group');
    expect(restored?.result).toBeNull();
  });

  it('recupera la nota persistida', () => {
    const restored = restoreGroupSession([
      { role: 'bob', content_json: { kind: GROUP_PLAN_KIND, exercise } },
      { role: 'bob', content_json: { kind: GROUP_EVALUATION_KIND, is_final: true, result: { correct: 2, total: 3, score_10: 6.7, results: [] } } },
    ]);
    expect(restored?.result).toMatchObject({ correct: 2, total: 3, score_10: 6.7 });
  });

  it('sin plan devuelve null', () => {
    expect(restoreGroupSession([{ role: 'user', content_json: null }])).toBeNull();
  });
});

describe('skill de las partes', () => {
  it.each([
    ['cambridge_fce_reading_part7', 'reading'],
    ['cambridge_fce_listening_part2', 'listening'],
    ['cambridge_fce_listening_part3', 'listening'],
    ['cambridge_fce_listening_part4', 'listening'],
  ])('%s -> %s', (mode, skill) => {
    expect(inferSkillFromMode(mode)).toBe(skill);
  });
});
