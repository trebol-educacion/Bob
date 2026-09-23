import type { PracticeActivityMode, PracticeSeed } from './types';

export interface PracticeSeedPools {
  angles: string[];
  characters: string[];
  tones: string[];
  situationTopics: string[];
  pictureTopics: string[];
}

export const DEFAULT_PRACTICE_SEED_POOLS: PracticeSeedPools = {
  angles: [
    'a surprising twist',
    'an everyday moment',
    'a small problem to solve',
    'a curious question',
    'a little celebration',
  ],
  characters: [
    'a friendly neighbor',
    'a shop assistant',
    'a new classmate',
    'a tour guide',
    'a café barista',
    'an old friend you just bumped into',
  ],
  tones: ['playful', 'curious', 'calm', 'enthusiastic', 'warm'],
  situationTopics: [
    'ordering food at a café',
    'asking for directions to the train station',
    'introducing yourself to someone new',
    'planning a weekend trip with a friend',
    'returning an item at a shop',
    'checking in at a hotel',
  ],
  pictureTopics: [
    'a busy street market',
    'a family having a picnic in the park',
    'a classroom during an art lesson',
    'a kitchen with people cooking together',
    'a beach on a sunny day',
    'an airport departure hall',
  ],
};

/**
 * @param mode PracticeActivityMode
 * @param rng () => number
 * @param pools PracticeSeedPools
 * @returns PracticeSeed
 */
export function pickPracticeSeed(
  mode: PracticeActivityMode,
  rng: () => number = Math.random,
  pools: PracticeSeedPools = DEFAULT_PRACTICE_SEED_POOLS
): PracticeSeed {
  const pick = (arr: string[]): string => arr[Math.floor(rng() * arr.length) % arr.length];

  const angle = pick(pools.angles);
  const character = pick(pools.characters);
  const tone = pick(pools.tones);

  const topic =
    mode === 'situation'
      ? pick(pools.situationTopics)
      : mode === 'picture'
        ? pick(pools.pictureTopics)
        : `a ${tone} chat with ${character}, with ${angle}`;

  return { angle, character, tone, topic };
}
