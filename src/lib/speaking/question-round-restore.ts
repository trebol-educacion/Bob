import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import type { QuestionRoundSchema } from './question-round-schema';
import type { SpeakingQA } from './types';

export interface RestorableRoundMessage {
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: unknown;
}

export interface RestoredQuestionRound<TPlan> {
  plan: TPlan;
  qas: SpeakingQA[];
  feedback: FormativeFeedback | null;
}

export const SPEAKING_ANSWER_KIND = 'speaking_answer';

function readAnswer(message: RestorableRoundMessage): SpeakingQA | null {
  const json = message.content_json as { kind?: string; question?: string } | null;
  const isAnswer = message.role === 'user' && (message.msg_type === 'user_audio' || json?.kind === SPEAKING_ANSWER_KIND);
  return isAnswer ? { question: json?.question ?? '', answer: message.content_text ?? '' } : null;
}

/**
 * @param messages stored messages of a question-round session
 * @param planSchema schema of the round plan
 * @returns plan, answers and final feedback found in the history, or null without a plan
 */
export function restoreQuestionRound<TPlan>(
  messages: RestorableRoundMessage[],
  planSchema: QuestionRoundSchema<TPlan>,
): RestoredQuestionRound<TPlan> | null {
  let plan: TPlan | null = null;
  const qas: SpeakingQA[] = [];
  let feedback: FormativeFeedback | null = null;

  for (const message of messages) {
    if (message.role === 'bob' && message.msg_type === 'phrase' && plan === null) {
      const parsed = planSchema.safeParse(message.content_json);
      if (parsed.success) plan = parsed.data as TPlan;
      continue;
    }
    if (message.role === 'bob' && message.msg_type === 'evaluation') {
      const parsed = FormativeFeedbackSchema.safeParse(message.content_json);
      if (parsed.success) feedback = parsed.data;
      continue;
    }
    const answer = readAnswer(message);
    if (answer) qas.push(answer);
  }

  return plan ? { plan, qas, feedback } : null;
}
