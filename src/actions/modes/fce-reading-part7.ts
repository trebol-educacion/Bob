'use server';

import { matchesLetterKey } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { createGroupStrategy } from '@/lib/item-bank/group-strategy';
import type { GroupSubmitInput } from '@/lib/item-bank/group-session-types';
import type { GroupAnswers } from '@/lib/item-bank/group-types';

const STRATEGY = createGroupStrategy({
  mode: 'cambridge_fce_reading_part7',
  examPart: 'fce_reading_part7',
  skill: 'reading',
  title: 'Reading Part 7, Multiple Matching',
  matcher: matchesLetterKey,
});

export async function startFCEReadingPart7Action() {
  return startGroupSession(STRATEGY);
}

export async function submitFCEReadingPart7Action(input: GroupSubmitInput<GroupAnswers>) {
  return submitGroupSession(STRATEGY, input);
}
