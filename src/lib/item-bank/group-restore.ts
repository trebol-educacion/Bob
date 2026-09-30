import {
  GROUP_EVALUATION_KIND,
  GROUP_PLAN_KIND,
  type RestorableMessage,
  type RestoredGroupSession,
} from './group-session-types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * @template E
 * @template R
 * @param messages
 * @param examPart
 * @returns persisted plan and final result, or null without a plan
 */
export function restoreGroupSession<E, R>(
  messages: RestorableMessage[],
  examPart?: string,
): RestoredGroupSession<E, R> | null {
  let exercise: E | null = null;
  let result: R | null = null;

  for (const message of messages) {
    const json = asRecord(message.content_json);
    if (!json || message.role !== 'bob') continue;
    if (examPart !== undefined && json.exam_part !== examPart) continue;
    if (json.kind === GROUP_PLAN_KIND && asRecord(json.exercise)) exercise = json.exercise as E;
    if (json.kind === GROUP_EVALUATION_KIND && json.is_final === true && asRecord(json.result)) {
      result = json.result as R;
    }
  }

  return exercise ? { exercise, result } : null;
}
