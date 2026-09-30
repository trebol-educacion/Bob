import type {
  FCEGroupedExercise,
  FCEGroupedItemResult,
  FCEGroupedPart,
  FCEGroupedScore,
} from '@/lib/reading/fce-grouped-types';

export interface RestorableMessage {
  role: string;
  content_json?: Record<string, unknown> | null;
}

export interface RestoredGroupedExercise {
  exercise: FCEGroupedExercise;
  results: FCEGroupedItemResult[] | null;
  score: FCEGroupedScore | null;
}

/**
 * @param part
 * @param messages
 * @returns persisted exercise and its result, or null when no plan was stored
 */
export function restoreGroupedExercise(
  part: FCEGroupedPart,
  messages: RestorableMessage[]
): RestoredGroupedExercise | null {
  let exercise: FCEGroupedExercise | null = null;
  let results: FCEGroupedItemResult[] | null = null;
  let score: FCEGroupedScore | null = null;

  for (const message of messages) {
    const json = message.content_json;
    if (!json || message.role !== 'bob' || json.part !== part) continue;
    if (json.kind === 'fce_grouped_plan' && json.exercise) {
      exercise = json.exercise as FCEGroupedExercise;
    }
    if (json.kind === 'fce_grouped_evaluation' && json.is_final === true && Array.isArray(json.results)) {
      results = json.results as FCEGroupedItemResult[];
      score = {
        correct: Number(json.score),
        total: Number(json.score_max),
        score10: Number(json.score_10),
      };
    }
  }

  return exercise ? { exercise, results, score } : null;
}
