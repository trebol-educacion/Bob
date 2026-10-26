import type { ToeflChooseResponsePlan } from '@/lib/bank-plans/toefl-choose-response';
import { resolveListeningAudioUrl } from '@/components/practice/group-exercise/listening-audio-url';
import type { ClosedItem } from '@/lib/types/practice';
import type { ClosedEntry } from '@/lib/toefl/closed-set';

export const CHOOSE_RESPONSE_PART = 'listen_choose_response';

const QUESTION = 'Choose the best response.';

/**
 * @param plan - stored Listen and Choose a Response set
 * @param groupId - bank group the set came from
 * @returns closed items with stable ids and the playable audio URL of each utterance
 */
export function toClosedItems(plan: ToeflChooseResponsePlan, groupId: string): ClosedItem[] {
  return plan.items.map((item, index) => ({
    id: `${groupId}-${index + 1}`,
    framework: 'toefl',
    exam_part: CHOOSE_RESPONSE_PART,
    cefr_level: 'b1',
    variant_id: `${groupId}-q${index + 1}`,
    stimulus_audio_url: resolveListeningAudioUrl(item.audio_url),
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

/**
 * @param items - closed items rebuilt from the stored plan
 * @param entries - answers sent by the client
 * @returns one entry per stored item, keyed against the stored answer
 */
export function keyEntriesFromBank(items: ClosedItem[], entries: ClosedEntry[]): ClosedEntry[] {
  const selectedById = new Map(entries.map((entry) => [entry.id, entry.selected]));
  return items.map((item) => ({
    id: item.variant_id,
    selected: selectedById.get(item.variant_id) ?? '',
    expected: item.correct_key,
    explanation: item.explanation,
    match: 'key',
  }));
}
