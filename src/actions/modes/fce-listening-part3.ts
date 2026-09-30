'use server';

import { matchesLetterKey } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession, type GroupPartConfig } from '@/lib/item-bank/group-session';
import type { GroupAnswers, GroupStartResult, GroupSubmitOutcome } from '@/lib/item-bank/group-types';

const CONFIG: GroupPartConfig = {
  mode: 'cambridge_fce_listening_part3',
  examPart: 'fce_listening_part3',
  skill: 'listening',
  title: 'Listening Part 3, Multiple Matching',
  matcher: matchesLetterKey,
};

export async function startFCEListeningPart3Action(): Promise<GroupStartResult> {
  return startGroupSession(CONFIG);
}

export async function submitFCEListeningPart3Action(
  sessionId: string,
  answers: GroupAnswers,
): Promise<GroupSubmitOutcome> {
  return submitGroupSession(CONFIG, sessionId, answers);
}
