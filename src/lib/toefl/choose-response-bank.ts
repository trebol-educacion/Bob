import type { ToeflChooseResponsePlan } from '@/lib/bank-plans/toefl-choose-response';
import type { ClosedItem } from '@/lib/types/practice';

export const CHOOSE_RESPONSE_PART = 'listen_choose_response';

const QUESTION = 'Choose the best response.';

/**
 * @param plan - stored Listen and Choose a Response set
 * @param groupId - bank group the set came from
 * @returns closed items with stable ids and the audio URL of each utterance
 */
export function toClosedItems(plan: ToeflChooseResponsePlan, groupId: string): ClosedItem[] {
  return plan.items.map((item, index) => ({
    id: `${groupId}-${index + 1}`,
    framework: 'toefl',
    exam_part: CHOOSE_RESPONSE_PART,
    cefr_level: 'b1',
    variant_id: `${groupId}-q${index + 1}`,
    stimulus_audio_url: item.audio_url,
    stimulus_text: null,
    stimulus_image_url: null,
    question: QUESTION,
    options: item.options,
    correct_key: item.correct_key,
    explanation: item.explanation,
    source: 'generated',
    group_id: groupId,
    group_order: index + 1,
    transcript: null,
  }));
}
