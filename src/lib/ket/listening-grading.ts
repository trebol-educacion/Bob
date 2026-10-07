import type { KetShortConversationsPlan } from '@/lib/bank-plans/ket-listening-part4';
import type { KetListenMatchPlan } from '@/lib/bank-plans/ket-listening-part5';

export interface KeyedResult {
  number: number;
  chosen: string | null;
  correct_key: string;
  is_correct: boolean;
  transcript?: string;
}

function transcriptOf(turns: { speaker: string; line: string }[]): string {
  return turns.map((turn) => `${turn.speaker === 'M' ? 'Man' : 'Woman'}: ${turn.line}`).join('\n');
}

/**
 * @param plan short conversations plan with keys
 * @param answers option chosen per item number
 * @returns per-item result with the transcript to review after submitting
 */
export function gradeShortConversations(plan: KetShortConversationsPlan, answers: Record<number, string>): KeyedResult[] {
  return plan.items.map((item) => {
    const chosen = answers[item.number] ?? null;
    return { number: item.number, chosen, correct_key: item.answer, is_correct: chosen === item.answer, transcript: transcriptOf(item.dialogue) };
  });
}

/**
 * @param plan matching plan with keys
 * @param answers option chosen per person number
 * @returns per-person result
 */
export function gradeListenMatch(plan: KetListenMatchPlan, answers: Record<number, string>): KeyedResult[] {
  return plan.people.map((person) => {
    const chosen = answers[person.number] ?? null;
    return { number: person.number, chosen, correct_key: person.answer, is_correct: chosen === person.answer };
  });
}

/**
 * @param plan matching plan
 * @returns full conversation transcript
 */
export function listenMatchTranscript(plan: KetListenMatchPlan): string {
  return transcriptOf(plan.conversation);
}
