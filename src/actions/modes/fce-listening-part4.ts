'use server';

import { matchesLetterKey } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession, type GroupPartConfig } from '@/lib/item-bank/group-session';
import type { GroupAnswers, GroupStartResult, GroupSubmitOutcome } from '@/lib/item-bank/group-types';

const CONFIG: GroupPartConfig = {
  mode: 'cambridge_fce_listening_part4',
  examPart: 'fce_listening_part4',
  skill: 'listening',
  title: 'Listening Part 4, Interview',
  matcher: matchesLetterKey,
};

export async function startFCEListeningPart4Action(): Promise<GroupStartResult> {
  return startGroupSession(CONFIG);
}

export async function submitFCEListeningPart4Action(
  sessionId: string,
  answers: GroupAnswers,
): Promise<GroupSubmitOutcome> {
  return submitGroupSession(CONFIG, sessionId, answers);
}
