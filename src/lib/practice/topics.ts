import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeSeed } from './types';

export type PracticeTopicAreaSlug = 'personal_life' | 'education_work' | 'leisure_travel' | 'society_science';

export interface PracticeTopic {
  slug: string;
  areaSlug: PracticeTopicAreaSlug;
  areaOrder: number;
  sortOrder: number;
  minCefrLevel: CefrLevel;
  promptDescription: string;
}

export interface PracticeTopicArea {
  areaSlug: PracticeTopicAreaSlug;
  topics: PracticeTopic[];
}

export const CEFR_ORDER: readonly CefrLevel[] = ['pre_a1', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

/**
 * @param level - effective level of the student
 * @returns every level a topic may declare as its minimum for this student to receive it
 */
export function levelsReachableFrom(level: CefrLevel): CefrLevel[] {
  return CEFR_ORDER.slice(0, CEFR_ORDER.indexOf(level) + 1);
}

/**
 * @param topics - topics already filtered by level
 * @returns topics grouped by area, ordered by area and by position inside each area
 */
export function groupTopicsByArea(topics: PracticeTopic[]): PracticeTopicArea[] {
  const sorted = [...topics].sort((a, b) => a.areaOrder - b.areaOrder || a.sortOrder - b.sortOrder);
  const areas: PracticeTopicArea[] = [];
  for (const topic of sorted) {
    const last = areas[areas.length - 1];
    if (last && last.areaSlug === topic.areaSlug) last.topics.push(topic);
    else areas.push({ areaSlug: topic.areaSlug, topics: [topic] });
  }
  return areas;
}

/**
 * @param topic - topic chosen by the student
 * @returns seed whose topic is the prompt description of the chosen topic
 */
export function buildTopicSeed(topic: PracticeTopic): PracticeSeed {
  return { angle: '', character: 'Bob', tone: 'friendly', topic: topic.promptDescription };
}
