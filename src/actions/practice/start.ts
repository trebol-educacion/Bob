'use server';

import { pickPracticeSeed } from '@/lib/practice/seed';
import { resolvePracticeLevel } from '@/lib/practice/level';
import { fetchPracticeTopics } from '@/lib/practice/topics-repository';
import { buildTopicSeed } from '@/lib/practice/topics';
import { MODE_PROMPT_KEY } from '@/lib/practice/mode-prompt-key';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

const TOPIC_MODES: readonly PracticeActivityMode[] = ['conversation', 'presentation'];

export interface PreparePracticeInput {
  mode: PracticeActivityMode;
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
  topicSlug?: string | null;
}

export interface PreparedPractice {
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
}

/**
 * @param input.mode - practice activity chosen by the student
 * @param input.skillLevels - per-skill levels of the student
 * @param input.cefrActiveLevel - level fixed by the tenant, when locked
 * @param input.topicSlug - topic chosen by the student; only conversation and presentation accept it, absent keeps the random seed
 * @returns effective level and the only seed of the run; creates no session and calls no LLM
 */
export async function preparePracticeAction(input: PreparePracticeInput): Promise<ActionResult<PreparedPractice>> {
  if (!(input.mode in MODE_PROMPT_KEY)) return fail('invalid_mode');
  const level = resolvePracticeLevel(input.skillLevels, input.cefrActiveLevel);
  if (!input.topicSlug) return ok({ mode: input.mode, level, seed: pickPracticeSeed(input.mode) });
  if (!TOPIC_MODES.includes(input.mode)) return fail('invalid_topic');

  const topics = await fetchPracticeTopics(level, input.topicSlug);
  if (!topics) return fail('topics_unavailable', true);
  if (topics.length === 0) return fail('invalid_topic');
  return ok({ mode: input.mode, level, seed: buildTopicSeed(topics[0]) });
}
