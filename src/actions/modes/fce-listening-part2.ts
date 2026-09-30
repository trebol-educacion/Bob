'use server';

import { matchesAcceptedText } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession, type GroupPartConfig } from '@/lib/item-bank/group-session';
import type { GroupAnswers, GroupStartResult, GroupSubmitOutcome } from '@/lib/item-bank/group-types';

const CONFIG: GroupPartConfig = {
  mode: 'cambridge_fce_listening_part2',
  examPart: 'fce_listening_part2',
  skill: 'listening',
  title: 'Listening Part 2, Sentence Completion',
  matcher: matchesAcceptedText,
};

export async function startFCEListeningPart2Action(): Promise<GroupStartResult> {
  return startGroupSession(CONFIG);
}

export async function submitFCEListeningPart2Action(
  sessionId: string,
  answers: GroupAnswers,
): Promise<GroupSubmitOutcome> {
  return submitGroupSession(CONFIG, sessionId, answers);
}
