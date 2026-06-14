/**
 * Pure scoring for the challenge. Objective parts (Listening, Reading) are
 * auto-corrected against the answer key. Writing and Speaking are never scored
 * numerically and are reported as qualitative submissions only.
 */

import type { ChallengePart } from './cambridge-a2';

export type PartResult =
  | { id: string; title: string; skill: ChallengePart['skill']; kind: 'objective'; correct: number; total: number }
  | { id: string; title: string; skill: ChallengePart['skill']; kind: 'qualitative' };

type Answers = Record<string, string>;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns the answer-key pairs (itemId → expected) for an objective part, or null. */
function objectiveKey(part: ChallengePart): Array<{ id: string; answer: string }> | null {
  switch (part.format) {
    case 'listening_picture_mc':
    case 'listening_conversation_mc':
    case 'listening_monologue_mc':
    case 'reading_notices_mc':
    case 'reading_long_text_mc':
      return part.questions.map((q) => ({ id: q.id, answer: q.answer }));
    case 'listening_note_completion':
      return part.gaps.map((g) => ({ id: g.id, answer: g.answer }));
    case 'listening_matching':
      return part.people.map((p) => ({ id: p.id, answer: p.answer }));
    case 'reading_multiple_matching':
      return part.statements.map((s) => ({ id: s.id, answer: s.answer }));
    case 'reading_mc_cloze':
    case 'reading_open_cloze':
      return part.segments.map((s) => ({ id: s.gap.id, answer: s.gap.answer }));
    default:
      return null;
  }
}

/** Scores a single part against the student's answers. */
export function scorePart(part: ChallengePart, answers: Answers): PartResult {
  const key = objectiveKey(part);
  if (!key) {
    return { id: part.id, title: part.title, skill: part.skill, kind: 'qualitative' };
  }
  const correct = key.reduce(
    (n, { id, answer }) => (normalize(answers[id] ?? '') === normalize(answer) ? n + 1 : n),
    0,
  );
  return { id: part.id, title: part.title, skill: part.skill, kind: 'objective', correct, total: key.length };
}

export interface ExamSummary {
  results: PartResult[];
  objectiveCorrect: number;
  objectiveTotal: number;
}

/** Builds the full exam summary from all parts and the collected answers. */
export function scoreExam(parts: ChallengePart[], answersByPart: Record<string, Answers>): ExamSummary {
  const results = parts.map((p) => scorePart(p, answersByPart[p.id] ?? {}));
  let objectiveCorrect = 0;
  let objectiveTotal = 0;
  for (const r of results) {
    if (r.kind === 'objective') {
      objectiveCorrect += r.correct;
      objectiveTotal += r.total;
    }
  }
  return { results, objectiveCorrect, objectiveTotal };
}
