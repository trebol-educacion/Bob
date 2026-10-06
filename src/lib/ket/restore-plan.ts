import type { StoredMessage } from '@/actions/messages';

export interface RestoredExercise<TExercise, TResult> {
  exercise: TExercise;
  framingText: string;
  results: TResult[] | null;
  correctCount: number;
}

/**
 * @template TExercise
 * @template TResult
 * @param messages - stored session messages
 * @param planKind - content_json kind of the plan message
 * @param resultsKey - key of the per-item results inside the final evaluation
 * @returns restored exercise with its final results, or null when the plan message is missing
 */
export function restoreExercise<TExercise, TResult>(
  messages: StoredMessage[],
  planKind: string,
  resultsKey: string,
): RestoredExercise<TExercise, TResult> | null {
  let exercise: TExercise | null = null;
  let framingText = '';
  let results: TResult[] | null = null;
  let correctCount = 0;
  for (const message of messages) {
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    if (message.role === 'bob' && json.kind === planKind) {
      exercise = json.exercise as TExercise;
      framingText = String(json.framing_text ?? '');
    }
    if (message.role === 'bob' && message.msg_type === 'evaluation' && json.is_final === true) {
      results = Array.isArray(json[resultsKey]) ? (json[resultsKey] as TResult[]) : null;
      correctCount = Number(json.score ?? 0);
    }
  }
  return exercise ? { exercise, framingText, results, correctCount } : null;
}
