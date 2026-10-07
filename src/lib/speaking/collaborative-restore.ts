import { FormativeFeedbackSchema } from '@/lib/types/practice';
import type { CollaborativeRestored, Part3ChatMessage, Part3Scenario } from './types';

export interface RestorableCollaborativeMessage {
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: unknown;
}

function asScenario(value: unknown): Part3Scenario | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const { topic, situation, prompt_question: promptQuestion, options } = record;
  if (typeof topic !== 'string' || typeof situation !== 'string' || typeof promptQuestion !== 'string') return null;
  if (!Array.isArray(options) || !options.every((option) => typeof option === 'string')) return null;
  return { topic, situation, prompt_question: promptQuestion, options: options as string[] };
}

/**
 * @param messages stored messages of a collaborative session
 * @returns scenario, conversation and final feedback found in the history
 */
export function restoreCollaborative(messages: RestorableCollaborativeMessage[]): CollaborativeRestored {
  let scenario: Part3Scenario | null = null;
  let feedback: CollaborativeRestored['feedback'] = null;
  const history: Part3ChatMessage[] = [];

  for (const message of messages) {
    if (message.role === 'bob' && message.msg_type === 'phrase' && scenario === null) {
      scenario = asScenario(message.content_json);
    } else if (message.role === 'bob' && message.msg_type === 'evaluation') {
      const parsed = FormativeFeedbackSchema.safeParse(message.content_json);
      if (parsed.success) feedback = parsed.data;
    } else if (message.msg_type === 'text') {
      history.push({ role: message.role === 'user' ? 'user' : 'examiner', text: message.content_text ?? '' });
    }
  }

  return { scenario, history, feedback };
}
