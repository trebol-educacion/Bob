import { EvalResponseSchema, type FormativeFeedback } from '@/lib/types/practice';

const SCORE_MAX = 20;
const CRITERION_MAX = 5;
const HIGHLIGHT_FROM_BAND = 4;
const UNDERSTOOD_FROM_SCORE10 = 5;

const CRITERIA = [
  { key: 'grammar_and_vocabulary', label: 'Grammar and vocabulary' },
  { key: 'discourse_management', label: 'Discourse management' },
  { key: 'pronunciation', label: 'Pronunciation' },
  { key: 'interactive_communication', label: 'Interactive communication' },
] as const;

type CriterionKey = (typeof CRITERIA)[number]['key'];

function clampBand(value: number): number {
  return Math.min(CRITERION_MAX, Math.max(0, Math.round(value)));
}

function normalizeRaw(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const record = raw as Record<string, unknown>;
  return typeof record.cefr_band === 'string' ? { ...record, cefr_band: record.cefr_band.toLowerCase() } : raw;
}

function readBands(bands: Partial<Record<CriterionKey, number | null | undefined>> | null | undefined) {
  if (!bands) return null;
  const values = CRITERIA.map(({ key }) => bands[key]);
  if (values.some((v) => typeof v !== 'number')) return null;
  return Object.fromEntries(CRITERIA.map(({ key }, i) => [key, clampBand(values[i] as number)])) as Record<CriterionKey, number>;
}

function scaleToMax(score: number, scoreMax: number): number {
  const ratio = scoreMax > 0 ? score / scoreMax : 0;
  return Math.min(SCORE_MAX, Math.max(0, Math.round(ratio * SCORE_MAX)));
}

/**
 * @param raw parsed JSON from an examiner evaluation prompt
 * @returns formative feedback with a code-derived 0-10 grade, or null when the shape is invalid
 */
export function toExaminerFeedback(raw: unknown): FormativeFeedback | null {
  const parsed = EvalResponseSchema.safeParse(normalizeRaw(raw));
  if (!parsed.success) return null;

  const { score, score_max, cefr_band, band_per_criterion, feedback, model_answer } = parsed.data;
  const bands = readBands(band_per_criterion);
  const total = bands
    ? CRITERIA.reduce((sum, { key }) => sum + bands[key], 0)
    : scaleToMax(score, score_max);
  const score10 = Math.round((total / SCORE_MAX) * 100) / 10;

  const scored = bands ? CRITERIA.map(({ key, label }) => ({ label, band: bands[key] })) : [];
  const highlights = scored
    .filter(({ band }) => band >= HIGHLIGHT_FROM_BAND)
    .map(({ label, band }) => `${label}: ${band}/${CRITERION_MAX}`);
  const suggestions = scored
    .filter(({ band }) => band < HIGHLIGHT_FROM_BAND)
    .sort((a, b) => a.band - b.band)
    .map(({ label, band }) => `Keep working on ${label.toLowerCase()} (${band}/${CRITERION_MAX})`);

  return {
    kind: 'formative',
    understood: score10 >= UNDERSTOOD_FROM_SCORE10,
    highlights,
    suggestions,
    model_answer: model_answer ?? undefined,
    feedback,
    score10,
    score: total,
    score_max: SCORE_MAX,
    cefr_band,
    band_per_criterion: bands ?? undefined,
  };
}
