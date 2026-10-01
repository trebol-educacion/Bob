export const FCE_GROUPED_PARTS = [
  'fce_reading_part2',
  'fce_reading_part3',
  'fce_reading_part4',
  'fce_reading_part5',
  'fce_reading_part6',
] as const;

export type FCEGroupedPart = (typeof FCE_GROUPED_PARTS)[number];

export type FCEGroupedAnswerKind = 'open' | 'key-word' | 'choice' | 'sentence';

export const FCE_GROUPED_ANSWER_KIND: Record<FCEGroupedPart, FCEGroupedAnswerKind> = {
  fce_reading_part2: 'open',
  fce_reading_part3: 'open',
  fce_reading_part4: 'key-word',
  fce_reading_part5: 'choice',
  fce_reading_part6: 'sentence',
};

export interface FCEGroupedOption {
  key: string;
  label: string;
}

export interface FCEGroupedItem {
  number: number;
  baseWord?: string;
  prompt?: string;
  keyword?: string;
  sentenceWithGap?: string;
  options?: FCEGroupedOption[];
}

export interface FCEGroupedExercise {
  groupId: string;
  part: FCEGroupedPart;
  title: string;
  text: string | null;
  items: FCEGroupedItem[];
  sentences: FCEGroupedOption[];
}

export interface FCEGroupedItemResult {
  number: number;
  given: string;
  expected: string;
  isCorrect: boolean;
}

export interface FCEGroupedScore {
  correct: number;
  total: number;
  score10: number;
}

export interface FCEGroupedStartResult {
  sessionId: string;
  exercise: FCEGroupedExercise;
}

export interface FCEGroupedSubmitResult extends FCEGroupedScore {
  results: FCEGroupedItemResult[];
}

/**
 * @param value
 * @returns true when value is a supported grouped part
 */
export function isFCEGroupedPart(value: string): value is FCEGroupedPart {
  return (FCE_GROUPED_PARTS as readonly string[]).includes(value);
}
