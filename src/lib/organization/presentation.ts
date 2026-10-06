import type { CardPresentation, DynamicCard } from '@/lib/types/practice';

export interface RawPresentationRow {
  framework: string;
  exam_part: string;
  cefr_level: string;
  student_title: string;
  student_description: string;
  minutes: number;
  icon_key: string;
  rules: Record<string, unknown> | null;
}

/**
 * @param framework string
 * @param examPart string
 * @param cefrLevel string | null
 * @returns lookup key shared by catalog cards and presentation rows
 */
export function presentationKey(framework: string, examPart: string, cefrLevel: string | null): string {
  return `${framework}|${examPart}|${cefrLevel ?? ''}`;
}

/**
 * @param row RawPresentationRow
 * @returns CardPresentation
 */
export function toCardPresentation(row: RawPresentationRow): CardPresentation {
  const rules = row.rules ?? {};
  return {
    title: row.student_title,
    description: row.student_description,
    minutes: row.minutes,
    iconKey: row.icon_key,
    rules: {
      allowRepeatOptions: typeof rules.allowRepeatOptions === 'boolean' ? rules.allowRepeatOptions : undefined,
    },
  };
}

/**
 * @param cards DynamicCard[]
 * @param rows RawPresentationRow[]
 * @returns cards with their presentation attached when a row exists
 */
export function attachPresentation(cards: DynamicCard[], rows: RawPresentationRow[]): DynamicCard[] {
  const byKey = new Map(rows.map((row) => [presentationKey(row.framework, row.exam_part, row.cefr_level || null), row]));
  return cards.map((card) => {
    const row = byKey.get(presentationKey(card.framework, card.exam_part, card.cefr_level));
    return row ? { ...card, presentation: toCardPresentation(row) } : card;
  });
}
