'use server';

import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { fceGroupedStrategy, type FCEGroupedAnswers } from '@/lib/reading/fce-grouped-strategy';
import type { GroupSubmitInput } from '@/lib/item-bank/group-session-types';
import { isFCEGroupedPart } from '@/lib/reading/fce-grouped-types';

export async function startFCEReadingExerciseAction(input: { part: string }) {
  if (!isFCEGroupedPart(input.part)) return { error: 'Unsupported part' };
  return startGroupSession(fceGroupedStrategy(input.part));
}

export async function submitFCEReadingExerciseAction(input: GroupSubmitInput<FCEGroupedAnswers> & { part: string }) {
  if (!isFCEGroupedPart(input.part)) return { error: 'Unsupported part' };
  const { part, ...submission } = input;
  return submitGroupSession(fceGroupedStrategy(part), submission);
}
