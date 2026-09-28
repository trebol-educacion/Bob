import type { PracticeRubricDetail } from '@/lib/practice/types';

export interface PracticeTurnSignal {
  hasAudio: boolean;
  hintUsed: boolean;
  modelAnswerUsed: boolean;
  turnScore: number | null;
}

export interface PracticeRubricResult {
  score: number;
  detail: PracticeRubricDetail;
  feedback: string;
}

const NO_TURNS_RESULT: PracticeRubricResult = {
  score: 0,
  detail: { participation: 0, fluency: 0, independence: 0, comprehension: 0 },
  feedback: 'No turns to grade yet, keep practicing to get feedback.',
};

const AUDIO_SCORE_CAP = 3;

/** @param n number */
function clampTo10(n: number): number {
  return Math.max(0, Math.min(10, n));
}

/**
 * @param turns PracticeTurnSignal[]
 * @returns PracticeRubricResult
 */
export function gradePracticeSession(turns: PracticeTurnSignal[]): PracticeRubricResult {
  if (turns.length === 0) return NO_TURNS_RESULT;

  const audioTurns = turns.filter((t) => t.hasAudio).length;
  const participation = clampTo10((audioTurns / turns.length) * 10);

  const scored = turns.filter((t): t is PracticeTurnSignal & { turnScore: number } => t.turnScore !== null);
  const avgScore = scored.length > 0 ? scored.reduce((sum, t) => sum + t.turnScore, 0) / scored.length : 0;
  const fluency = clampTo10(avgScore / 10);

  const assistedCount = turns.filter((t) => t.hintUsed || t.modelAnswerUsed).length;
  const independence = clampTo10(10 - (assistedCount / turns.length) * 10);

  const comprehension = clampTo10(turns.length >= 4 ? 8 : turns.length * 2);

  let score = clampTo10(
    participation * 0.35 + fluency * 0.3 + independence * 0.2 + comprehension * 0.15
  );

  if (audioTurns === 0) {
    score = Math.min(score, AUDIO_SCORE_CAP);
  }

  score = Math.round(score * 10) / 10;

  const feedback =
    audioTurns === 0
      ? 'Try speaking your answers out loud next time, that is what Bob listens for.'
      : independence < 5
        ? 'Good effort. Try answering before reaching for a hint or the model answer next time.'
        : 'Nice work! You spoke clearly and kept the conversation going.';

  return {
    score,
    detail: { participation, fluency, independence, comprehension },
    feedback,
  };
}
