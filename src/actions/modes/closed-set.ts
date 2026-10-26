'use server';

import { completeActivity } from '@/lib/session/complete';
import { bankStamp, loadPlan } from '@/lib/item-bank/plan-bank';
import { ToeflChooseResponsePlanSchema } from '@/lib/bank-plans/toefl-choose-response';
import { keyEntriesFromBank, toClosedItems } from '@/lib/toefl/choose-response-bank';
import {
  CLOSED_ANSWER_KIND,
  CLOSED_PLAN_KIND,
  buildClosedEvaluation,
  scoreClosedEntries,
  type ClosedEntry,
  type ClosedEntryResult,
} from '@/lib/toefl/closed-set';

const CLOSED_SET_MODES = ['toefl_listen_choose_response', 'toefl_writing_build_sentence'] as const;

type ClosedSetMode = (typeof CLOSED_SET_MODES)[number];

const BANK_PART: Record<ClosedSetMode, string> = {
  toefl_listen_choose_response: 'listen_choose_response',
  toefl_writing_build_sentence: 'toefl_writing_build_sentence',
};

export interface ClosedSetSubmission {
  mode: ClosedSetMode;
  sessionId?: string;
  items: unknown[];
  bankGroupId?: string;
  entries: ClosedEntry[];
}

export interface ClosedSetOutcome {
  sessionId: string;
  results: ClosedEntryResult[];
}

interface TrustedSubmission {
  items: unknown[];
  entries: ClosedEntry[];
}

/**
 * @param input - submission from the client
 * @returns items and entries keyed against the bank, or null when the set cannot be verified
 */
async function trustedSubmission(input: ClosedSetSubmission): Promise<TrustedSubmission | null> {
  if (input.mode !== 'toefl_listen_choose_response') return { items: input.items, entries: input.entries };
  if (!input.bankGroupId) return null;
  const plan = await loadPlan(input.bankGroupId, ToeflChooseResponsePlanSchema);
  if (!plan.ok) return null;
  const items = toClosedItems(plan.data, input.bankGroupId);
  return { items, entries: keyEntriesFromBank(items, input.entries) };
}

/**
 * @param input - mode, items shown and the answers given
 * @returns graded results; the session is created here, on the first turn, and closed with its 0-10 grade
 */
export async function submitClosedSetAction(input: ClosedSetSubmission): Promise<ClosedSetOutcome | { error: string }> {
  if (!CLOSED_SET_MODES.includes(input.mode) || input.entries.length === 0) return { error: 'invalid_submission' };
  const trusted = await trustedSubmission(input);
  if (!trusted) return { error: 'invalid_submission' };
  const results = scoreClosedEntries(trusted.entries);
  const completed = await completeActivity({
    mode: input.mode,
    sessionId: input.sessionId,
    bank: bankStamp(BANK_PART[input.mode], input.bankGroupId),
    plan: { kind: CLOSED_PLAN_KIND, items: trusted.items },
    answers: trusted.entries.map((entry) => ({ kind: CLOSED_ANSWER_KIND, id: entry.id, selected: entry.selected })),
    evaluation: buildClosedEvaluation(results),
  });
  if (!completed.ok) return { error: completed.code };
  return { sessionId: completed.data.sessionId, results };
}
