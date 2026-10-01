'use server';

import { startGroupSession, submitGroupSession } from '@/lib/item-bank/group-session';
import { fceGroupedStrategy, type FCEGroupedAnswers } from '@/lib/reading/fce-grouped-strategy';
import { isFCEGroupedPart } from '@/lib/reading/fce-grouped-types';

export async function startFCEReadingExerciseAction(input: { part: string }) {
  if (!isFCEGroupedPart(input.part)) return { error: 'Unsupported part' };
  return startGroupSession(fceGroupedStrategy(input.part));
}

export async function submitFCEReadingExerciseAction(input: {
  sessionId: string;
  part: string;
  answers: FCEGroupedAnswers;
}) {
  if (!isFCEGroupedPart(input.part)) return { error: 'Unsupported part' };
  return submitGroupSession(fceGroupedStrategy(input.part), input.sessionId, input.answers);
}
