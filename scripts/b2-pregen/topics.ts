const TOPICS = [
  'technology and everyday life',
  'the environment and sustainable living',
  'psychology and personal development',
  'travel and cultural exchange',
  'health, sport and wellbeing',
  'education and learning new skills',
  'work, careers and remote working',
  'the arts, music and creativity',
  'science and new discoveries',
  'food, cities and modern society',
  'volunteering and community projects',
  'history and heritage',
];

/**
 * @param examPartIndex
 * @param slot
 * @returns topic chosen deterministically so each slot differs
 */
export function topicFor(examPartIndex: number, slot: number): string {
  return TOPICS[(examPartIndex * 5 + slot - 1) % TOPICS.length];
}
