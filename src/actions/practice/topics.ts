'use server';

import { fetchPracticeTopics } from '@/lib/practice/topics-repository';
import { groupTopicsByArea, type PracticeTopicArea } from '@/lib/practice/topics';
import { resolvePracticeLevel } from '@/lib/practice/level';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface ListPracticeTopicsInput {
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
}

/**
 * @param input.skillLevels - per-skill levels of the student
 * @param input.cefrActiveLevel - level fixed by the tenant, when locked
 * @returns topic areas the effective level allows; a single query, no LLM
 */
export async function listPracticeTopicsAction(input: ListPracticeTopicsInput): Promise<ActionResult<PracticeTopicArea[]>> {
  const level = resolvePracticeLevel(input.skillLevels, input.cefrActiveLevel);
  const topics = await fetchPracticeTopics(level);
  if (!topics) return fail('topics_unavailable', true);
  return ok(groupTopicsByArea(topics));
}
