const RUBRIC_CRITERIA = ['task_coverage', 'grammar', 'vocabulary', 'fluency'] as const;
const RUBRIC_CRITERION_MAX = 4;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampToScale(value: number): number {
  return Math.min(10, Math.max(0, value));
}

/**
 * @param raw - obtained points
 * @param max - maximum points
 * @returns grade on a 0-10 scale with one decimal, or null when max is not positive
 */
export function ratioToScore10(raw: number, max: number): number | null {
  if (!isFiniteNumber(raw) || !isFiniteNumber(max) || max <= 0) return null;
  return clampToScale(Math.round((raw / max) * 100) / 10);
}

function fromRubric(rubric: unknown): number | null {
  if (typeof rubric !== 'object' || rubric === null) return null;
  const record = rubric as Record<string, unknown>;
  const values = RUBRIC_CRITERIA.map((key) => record[key]);
  if (!values.every(isFiniteNumber)) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return ratioToScore10(total, RUBRIC_CRITERIA.length * RUBRIC_CRITERION_MAX);
}

/**
 * @param evaluation - final evaluation payload in any of the stored formats
 * @returns canonical 0-10 grade or null when the payload carries no grade
 */
export function toScore10(evaluation: unknown): number | null {
  if (typeof evaluation !== 'object' || evaluation === null) return null;
  const record = evaluation as Record<string, unknown>;
  if (isFiniteNumber(record.score) && isFiniteNumber(record.score_max)) {
    const ratio = ratioToScore10(record.score, record.score_max);
    if (ratio !== null) return ratio;
  }
  if (isFiniteNumber(record.score_10)) return clampToScale(Math.round(record.score_10 * 10) / 10);
  if (isFiniteNumber(record.score10)) return clampToScale(Math.round(record.score10 * 10) / 10);
  return fromRubric(record.rubric);
}
