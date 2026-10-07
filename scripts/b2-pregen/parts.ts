import { ADAPTERS, type Adapter } from './adapters';
import { PART_SHORT } from './variant';
import { topicFor, type TopicList } from './topics';

export interface PartSpec {
  promptKey: string;
  topicList: TopicList;
  systemPrompt: (prompt: string, topic: string) => string;
  userMessage: (topic: string) => string;
  adapt: Adapter | null;
}

const DEFAULT_MESSAGE = (topic: string) => `Topic: ${topic}. Return the JSON only.`;
const KEEP = (prompt: string) => prompt;
const WITH_TOPIC = (prompt: string, topic: string) => prompt.replaceAll('{TOPIC}', topic);

const CUSTOM: Record<string, Partial<PartSpec> & { promptKey: string }> = {
  fce_reading_part1: { promptKey: 'cambridge_fce_reading_part1_b2_generation' },
  fce_writing_part1: { promptKey: 'cambridge_fce_writing_part1_b2_generation' },
  fce_speaking_part1: { promptKey: 'cambridge_fce_p1_b2_generation', topicList: 'interview' },
  fce_speaking_part2: { promptKey: 'cambridge_fce_p2_b2_generation', topicList: 'picture', systemPrompt: WITH_TOPIC },
  fce_speaking_part4: { promptKey: 'cambridge_fce_p4_b2_generation', topicList: 'discussion', systemPrompt: WITH_TOPIC },
};

/**
 * @param examPart
 * @returns how the part is prompted and adapted to the bank payload
 */
export function partSpec(examPart: string): PartSpec {
  const custom = CUSTOM[examPart];
  return {
    promptKey: custom?.promptKey ?? `cambridge_${examPart}_b2_generation`,
    topicList: custom?.topicList ?? 'general',
    systemPrompt: custom?.systemPrompt ?? KEEP,
    userMessage: DEFAULT_MESSAGE,
    adapt: ADAPTERS[examPart] ?? null,
  };
}

/**
 * @param examPart
 * @param slot
 * @returns deterministic topic of the slot
 */
export function slotTopic(examPart: string, slot: number): string {
  const index = Object.keys(PART_SHORT).indexOf(examPart);
  return topicFor(index, slot, partSpec(examPart).topicList);
}
