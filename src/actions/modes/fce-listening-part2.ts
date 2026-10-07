'use server';

import { matchesAcceptedText } from '@/lib/item-bank/group-grading';
import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { createGroupStrategy } from '@/lib/item-bank/group-strategy';
import type { GroupSubmitInput } from '@/lib/item-bank/group-session-types';
import type { GroupAnswers } from '@/lib/item-bank/group-types';

const STRATEGY = createGroupStrategy({
  mode: 'cambridge_fce_listening_part2',
  examPart: 'fce_listening_part2',
  skill: 'listening',
  title: 'Listening Part 2, Sentence Completion',
  matcher: matchesAcceptedText,
});

export async function startFCEListeningPart2Action() {
  return startGroupSession(STRATEGY);
}

export async function submitFCEListeningPart2Action(input: GroupSubmitInput<GroupAnswers>) {
  return submitGroupSession(STRATEGY, input);
}
