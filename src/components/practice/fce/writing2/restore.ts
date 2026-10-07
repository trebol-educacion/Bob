import type { StoredMessage } from '@/actions/messages';
import type { WritingFormativeFeedback } from '@/lib/types/practice';
import { parseFceRubric } from '@/lib/writing/fce-rubric';
import {
  FCE_PART2_SUBMISSION_KIND,
  FCE_PART2_WORD_RANGE,
  readFcePart2Plan,
  type FcePart2Plan,
} from '@/lib/writing/fce-part2';

export interface FcePart2Restored {
  plan: FcePart2Plan | null;
  taskNumber: number | null;
  text: string | null;
  feedback: WritingFormativeFeedback | null;
}

function readFeedback(json: Record<string, unknown>): WritingFormativeFeedback | null {
  const rubric = parseFceRubric(json.fce_rubric);
  if (!rubric || typeof json.score_10 !== 'number') return null;
  const indicators = json.indicators as WritingFormativeFeedback['indicators'] | undefined;
  return {
    kind: 'writing_formative',
    understood: Boolean(json.understood),
    highlights: Array.isArray(json.highlights) ? (json.highlights as string[]) : [],
    suggestions: Array.isArray(json.suggestions) ? (json.suggestions as string[]) : [],
    model_answer: typeof json.model_answer === 'string' ? json.model_answer : undefined,
    score_10: json.score_10,
    fce_rubric: rubric,
    indicators: indicators ?? { word_count: 0, target_word_count_range: FCE_PART2_WORD_RANGE },
  };
}

/**
 * @param messages stored messages of a Writing Part 2 session
 * @returns the task set, the chosen task, the submitted text and the final feedback found in the history
 */
export function restoreFcePart2(messages: StoredMessage[]): FcePart2Restored {
  const restored: FcePart2Restored = { plan: null, taskNumber: null, text: null, feedback: null };
  for (const message of messages) {
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    const plan = message.role === 'bob' ? readFcePart2Plan(json) : null;
    if (plan) {
      restored.plan = plan;
    }
    if (message.role === 'user' && json.kind === FCE_PART2_SUBMISSION_KIND) {
      restored.text = String(json.text ?? '');
      restored.taskNumber = typeof json.task_number === 'number' ? json.task_number : null;
    }
    if (message.role === 'bob' && message.msg_type === 'evaluation' && json.is_final === true) {
      restored.feedback = readFeedback(json) ?? restored.feedback;
    }
  }
  return restored;
}
