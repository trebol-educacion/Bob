import type { WritingFormativeFeedback } from '@/lib/types/practice';

export const OPEN_WRITING_PLAN_KIND = 'writing_prompt';
export const OPEN_WRITING_SUBMISSION_KIND = 'writing_submission';

export interface RestorableWritingMessage {
  role: string;
  msg_type: string;
  content_json?: unknown;
}

export interface RestoredOpenWriting {
  text: string;
  feedback: WritingFormativeFeedback;
  instructions: string | null;
  task: Record<string, unknown> | null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readFeedback(json: Record<string, unknown>): WritingFormativeFeedback | null {
  const indicators = json.indicators as WritingFormativeFeedback['indicators'] | undefined;
  if (!indicators || typeof indicators.word_count !== 'number') return null;
  return {
    kind: 'writing_formative',
    understood: Boolean(json.understood),
    highlights: stringList(json.highlights),
    suggestions: stringList(json.suggestions),
    model_answer: typeof json.model_answer === 'string' ? json.model_answer : undefined,
    rubric: (json.rubric as WritingFormativeFeedback['rubric']) ?? undefined,
    indicators,
  };
}

/**
 * @param messages - stored messages of an open-writing session
 * @returns submitted text and final feedback, or null when the session was never evaluated
 */
export function restoreOpenWriting(messages: RestorableWritingMessage[]): RestoredOpenWriting | null {
  let text: string | null = null;
  let feedback: WritingFormativeFeedback | null = null;
  let instructions: string | null = null;
  let task: Record<string, unknown> | null = null;
  for (const message of messages) {
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    if (message.role === 'bob' && json.kind === OPEN_WRITING_PLAN_KIND) {
      instructions = typeof json.instructions === 'string' ? json.instructions : null;
      task = json.task && typeof json.task === 'object' ? (json.task as Record<string, unknown>) : null;
    }
    if (message.role === 'user' && json.kind === OPEN_WRITING_SUBMISSION_KIND) text = String(json.text ?? '');
    if (message.role === 'bob' && message.msg_type === 'evaluation' && json.is_final === true) {
      feedback = readFeedback(json) ?? feedback;
    }
  }
  return text !== null && feedback ? { text, feedback, instructions, task } : null;
}
