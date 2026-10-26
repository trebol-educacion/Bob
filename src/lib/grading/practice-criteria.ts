import type { PracticeCriteriaRubricDetail } from '@/lib/practice/types';

export const PRACTICE_CRITERIA = ['pronunciation', 'fluency', 'grammar', 'vocabulary'] as const;

export type PracticeCriterionKey = (typeof PRACTICE_CRITERIA)[number];

export type PracticeTurnCriteria = Record<PracticeCriterionKey, number | null>;

export interface PracticeCriteriaGrade {
  score: number;
  detail: PracticeCriteriaRubricDetail;
  feedback: string;
}

export const CRITERION_BAND_MAX = 5;

const DETAIL_SCALE = 10;
const STRONG_FROM_BAND = 4;

function isBand(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampBand(value: number): number {
  return Math.min(CRITERION_BAND_MAX, Math.max(0, value));
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * @param raw - criteria object read from a model response or a stored message
 * @returns validated bands clamped to 0-5, or null when fluency, grammar and vocabulary are not all numeric
 */
export function readTurnCriteria(raw: unknown): PracticeTurnCriteria | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (!isBand(record.fluency) || !isBand(record.grammar) || !isBand(record.vocabulary)) return null;
  return {
    pronunciation: isBand(record.pronunciation) ? clampBand(record.pronunciation) : null,
    fluency: clampBand(record.fluency),
    grammar: clampBand(record.grammar),
    vocabulary: clampBand(record.vocabulary),
  };
}

function buildFeedback(bands: Record<PracticeCriterionKey, number | null>): string {
  const scored = PRACTICE_CRITERIA.flatMap((key) => (bands[key] === null ? [] : [{ key, band: bands[key] as number }]));
  const best = scored.reduce((a, b) => (b.band > a.band ? b : a));
  const worst = scored.reduce((a, b) => (b.band < a.band ? b : a));
  if (worst.band >= STRONG_FROM_BAND) {
    return 'Great work! Your English was clear and consistent across every area. Keep practising to stay sharp.';
  }
  if (best.key === worst.key) {
    return `Keep working on your ${worst.key}, it is the best area to improve next.`;
  }
  return `Nice work on your ${best.key}. Next, focus on your ${worst.key} to improve even more.`;
}

/**
 * @param turns - per-turn criteria of the student turns that carried them
 * @returns grade 0-10 as the equal-weight mean of the criterion means (pronunciation is left out when no audio turn rated it), or null when no turn carried criteria
 */
export function gradeFromTurnCriteria(turns: Array<PracticeTurnCriteria | null | undefined>): PracticeCriteriaGrade | null {
  const rated = turns.filter((t): t is PracticeTurnCriteria => t !== null && t !== undefined);
  if (rated.length === 0) return null;

  const bands = Object.fromEntries(
    PRACTICE_CRITERIA.map((key) => [key, average(rated.flatMap((t) => (t[key] === null ? [] : [t[key] as number])))])
  ) as Record<PracticeCriterionKey, number | null>;

  const present = PRACTICE_CRITERIA.flatMap((key) => (bands[key] === null ? [] : [bands[key] as number]));
  const mean = average(present) as number;
  const toDetail = (band: number | null) => (band === null ? null : roundOneDecimal((band / CRITERION_BAND_MAX) * DETAIL_SCALE));

  return {
    score: roundOneDecimal((mean / CRITERION_BAND_MAX) * DETAIL_SCALE),
    detail: {
      pronunciation: toDetail(bands.pronunciation),
      fluency: toDetail(bands.fluency) as number,
      grammar: toDetail(bands.grammar) as number,
      vocabulary: toDetail(bands.vocabulary) as number,
    },
    feedback: buildFeedback(bands),
  };
}
