'use server';

import { matchesLetterKey } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { createGroupStrategy } from '@/lib/item-bank/group-strategy';
import type { GroupSubmitInput } from '@/lib/item-bank/group-session-types';
import type { GroupAnswers } from '@/lib/item-bank/group-types';

const STRATEGY = createGroupStrategy({
  mode: 'cambridge_fce_listening_part4',
  examPart: 'fce_listening_part4',
  skill: 'listening',
  title: 'Listening Part 4, Interview',
  matcher: matchesLetterKey,
});

export async function startFCEListeningPart4Action() {
  return startGroupSession(STRATEGY);
}

export async function submitFCEListeningPart4Action(input: GroupSubmitInput<GroupAnswers>) {
  return submitGroupSession(STRATEGY, input);
}
