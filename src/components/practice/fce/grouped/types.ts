import type { FCEGroupedExercise, FCEGroupedItemResult } from '@/lib/reading/fce-grouped-types';

export interface GroupedBodyProps {
  exercise: FCEGroupedExercise;
  answers: Record<number, string>;
  onAnswer: (number: number, value: string) => void;
  results: FCEGroupedItemResult[] | null;
}
