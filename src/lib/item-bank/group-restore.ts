import {
  GROUP_EVALUATION_KIND,
  GROUP_PLAN_KIND,
  type GroupExercisePayload,
  type GroupSubmitResult,
} from './group-types';

export interface RestorableMessage {
  role: string;
  content_json?: unknown;
}

export interface RestoredGroupSession {
  exercise: GroupExercisePayload;
  result: GroupSubmitResult | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function restoreGroupSession(messages: RestorableMessage[]): RestoredGroupSession | null {
  let exercise: GroupExercisePayload | null = null;
  let result: GroupSubmitResult | null = null;

  for (const message of messages) {
    const json = asRecord(message.content_json);
    if (!json || message.role !== 'bob') continue;
    if (json.kind === GROUP_PLAN_KIND && asRecord(json.exercise)) {
      exercise = json.exercise as unknown as GroupExercisePayload;
    }
    if (json.kind === GROUP_EVALUATION_KIND && json.is_final === true && Array.isArray(json.results)) {
      result = {
        correct: Number(json.score),
        total: Number(json.score_max),
        score_10: Number(json.score_10),
        results: json.results as GroupSubmitResult['results'],
      };
    }
  }

  return exercise ? { exercise, result } : null;
}
