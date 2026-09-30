'use server';

import { matchesLetterKey } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { createGroupStrategy } from '@/lib/item-bank/group-strategy';
import type { GroupAnswers } from '@/lib/item-bank/group-types';

const STRATEGY = createGroupStrategy({
  mode: 'cambridge_fce_listening_part3',
  examPart: 'fce_listening_part3',
  skill: 'listening',
  title: 'Listening Part 3, Multiple Matching',
  matcher: matchesLetterKey,
});

export async function startFCEListeningPart3Action() {
  return startGroupSession(STRATEGY);
}

export async function submitFCEListeningPart3Action(sessionId: string, answers: GroupAnswers) {
  return submitGroupSession(STRATEGY, sessionId, answers);
}
