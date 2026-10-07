import { B2_PICTURE_TOPICS } from '../../src/actions/modes/fce-p2/shared';

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

const INTERVIEW_THEMES = [
  'daily routines and free time',
  'studies and school life',
  'work, jobs and future plans',
  'home, family and neighbourhood',
  'food, cooking and eating out',
  'holidays and travelling',
  'sport, health and staying fit',
  'technology and social media',
  'shopping, money and fashion',
  'recent experiences and special occasions',
  'music, films and books',
  'friends and spending time together',
];

const DISCUSSION_TOPICS = [
  'What could a town do to encourage people to use public transport?',
  'How can a school help students to stay healthy?',
  'What would make a new local museum attractive to young people?',
  'How can a company encourage its employees to protect the environment?',
  'What could a city do to make life better for young people?',
  'How can people be encouraged to keep learning new skills throughout their lives?',
];

export type TopicList = 'general' | 'interview' | 'discussion' | 'picture';

const LISTS: Record<TopicList, string[]> = {
  general: TOPICS,
  interview: INTERVIEW_THEMES,
  discussion: DISCUSSION_TOPICS,
  picture: [...B2_PICTURE_TOPICS],
};

/**
 * @param examPartIndex
 * @param slot
 * @param list topic list of the part
 * @returns topic chosen deterministically so each slot differs
 */
export function topicFor(examPartIndex: number, slot: number, list: TopicList = 'general'): string {
  const topics = LISTS[list];
  const offset = list === 'general' ? examPartIndex * 5 : 0;
  return topics[(offset + slot - 1) % topics.length];
}
