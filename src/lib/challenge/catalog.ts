import type { CefrLevel } from '@/lib/types/practice';

export type ChallengeFramework = 'cambridge_a2_key';

export interface ChallengeEntry {
  id: string;
  title: string;
  description: string;
  cefr: CefrLevel | null;
  framework: ChallengeFramework | null;
}

export interface ChallengeOption extends ChallengeEntry {
  available: boolean;
  matchesLevel: boolean;
}

export const CHALLENGES: readonly ChallengeEntry[] = [
  {
    id: 'cambridge_a2_key',
    title: 'Cambridge A2 Key',
    description: '14 parts across Listening, Reading, Writing and Speaking.',
    cefr: 'a2',
    framework: 'cambridge_a2_key',
  },
  {
    id: 'cambridge_b1_preliminary',
    title: 'Cambridge B1 Preliminary',
    description: 'Full B1 mock exam with all four skills.',
    cefr: 'b1',
    framework: null,
  },
  {
    id: 'cambridge_b2_first',
    title: 'Cambridge B2 First',
    description: 'Full B2 mock exam with all four skills.',
    cefr: 'b2',
    framework: null,
  },
  {
    id: 'oxford',
    title: 'Oxford',
    description: 'Oxford Test of English.',
    cefr: null,
    framework: null,
  },
];

/**
 * @param studentLevel CEFR level assigned by the school
 * @returns challenges with the student's level first, then available ones
 */
export function challengesForLevel(studentLevel: CefrLevel | null): ChallengeOption[] {
  const options = CHALLENGES.map((entry) => ({
    ...entry,
    available: entry.framework !== null,
    matchesLevel: studentLevel !== null && entry.cefr === studentLevel,
  }));
  const rank = (option: ChallengeOption) => (option.matchesLevel ? 0 : option.available ? 1 : 2);
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => rank(a.option) - rank(b.option) || a.index - b.index)
    .map(({ option }) => option);
}
