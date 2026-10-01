import { z } from 'zod';

export const FCE_CRITERIA = ['content', 'communicative_achievement', 'organisation', 'language'] as const;

export type FceCriterion = (typeof FCE_CRITERIA)[number];

const CriterionSchema = z.number().int().min(0).max(5);

export const FceRubricSchema = z.object({
  content: CriterionSchema,
  communicative_achievement: CriterionSchema,
  organisation: CriterionSchema,
  language: CriterionSchema,
});

export type FceRubric = z.infer<typeof FceRubricSchema>;

export const FCE_RUBRIC_MAX = FCE_CRITERIA.length * 5;

export interface FceScorePayload {
  score: number;
  score_max: number;
  score_10: number;
  fce_rubric: FceRubric;
}

/**
 * @param raw unknown rubric value from the model or storage
 * @returns the rubric, or null when any criterion is missing or out of range
 */
export function parseFceRubric(raw: unknown): FceRubric | null {
  const parsed = FceRubricSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * @param rubric validated FCE rubric
 * @returns sum of the four criteria, 0-20
 */
export function fceRubricTotal(rubric: FceRubric): number {
  return FCE_CRITERIA.reduce((sum, criterion) => sum + rubric[criterion], 0);
}

/**
 * @param rubric validated FCE rubric
 * @returns mark 0-10 with one decimal, total / 2
 */
export function fceScore10(rubric: FceRubric): number {
  return Math.round((fceRubricTotal(rubric) / FCE_RUBRIC_MAX) * 100) / 10;
}

/**
 * @param rubric validated FCE rubric
 * @returns fields persisted in the final evaluation message
 */
export function buildFceScorePayload(rubric: FceRubric): FceScorePayload {
  return {
    score: fceRubricTotal(rubric),
    score_max: FCE_RUBRIC_MAX,
    score_10: fceScore10(rubric),
    fce_rubric: rubric,
  };
}
