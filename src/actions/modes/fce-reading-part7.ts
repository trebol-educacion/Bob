'use server';

import { matchesLetterKey } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession, type GroupPartConfig } from '@/lib/item-bank/group-session';
import type { GroupAnswers, GroupStartResult, GroupSubmitOutcome } from '@/lib/item-bank/group-types';

const CONFIG: GroupPartConfig = {
  mode: 'cambridge_fce_reading_part7',
  examPart: 'fce_reading_part7',
  skill: 'reading',
  title: 'Reading Part 7, Multiple Matching',
  matcher: matchesLetterKey,
};

export async function startFCEReadingPart7Action(): Promise<GroupStartResult> {
  return startGroupSession(CONFIG);
}

export async function submitFCEReadingPart7Action(
  sessionId: string,
  answers: GroupAnswers,
): Promise<GroupSubmitOutcome> {
  return submitGroupSession(CONFIG, sessionId, answers);
}
