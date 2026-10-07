'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { fetchGroupItems, fetchGroups } from '@/actions/item-bank/repository';
import { pickContent } from '@/lib/item-bank/content-source';
import { gradeCloze, toClozePlan, type ClozeGapResult, type ClozeOptionId, type ClozePlan } from '@/lib/reading/fce-cloze-bank';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';

const FCE_CLOZE_MODE = 'cambridge_fce_reading_part1';
const FCE_CLOZE_PART = 'fce_reading_part1';
const FRAMING_FALLBACK =
  'You will read a short text with 8 missing words. For each gap, choose the best option from A, B, C, or D. Read the WHOLE sentence, sometimes the answer depends on the words around the gap.';

/** Full result of a successful bank read. */
export interface FCEClozeResult extends ClozePlan {
  framingText: string;
}

/** Full submit result. */
export interface FCEClozeSubmitResult {
  sessionId: string;
  correctCount: number;
  total: number;
  results: ClozeGapResult[];
}

async function framing(): Promise<string> {
  return getPrompt('cambridge_fce_reading_part1_b2_framing').catch(() => FRAMING_FALLBACK);
}

/** Reads one pregenerated cloze from the bank; no model call and no session row. */
export async function generateFCEClozeAction(): Promise<ActionResult<FCEClozeResult>> {
  const picked = await pickContent({
    framework: 'fce',
    cefr: 'b2',
    examPart: FCE_CLOZE_PART,
    purpose: 'practice',
    skill: 'reading',
    groupsOnly: true,
  });
  if (!picked.ok) return picked;
  if (picked.data.kind !== 'group') return fail('no_content');
  return ok({ ...toClozePlan(picked.data.group, picked.data.items), framingText: await framing() });
}

/** Grades from the stored keys; creates the session on this first turn and closes it. */
export async function submitFCEClozeAnswersAction(input: {
  sessionId?: string;
  groupId: string;
  answers: Record<number, ClozeOptionId>;
}): Promise<ActionResult<FCEClozeSubmitResult>> {
  const [groups, items] = await Promise.all([fetchGroups({ id: input.groupId }), fetchGroupItems([input.groupId])]);
  if (!groups.ok || !items.ok || groups.data.length === 0 || items.data.length === 0) return fail('no_content');

  const results = gradeCloze(items.data, input.answers);
  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = results.length;

  const session = await ensureSession({ mode: FCE_CLOZE_MODE, sessionId: input.sessionId });
  if (!session.ok) return session;

  const planMessages = session.data.created
    ? [
        {
          role: 'bob' as const,
          msgType: 'text' as const,
          contentText: null,
          contentJson: {
            kind: 'cloze_plan',
            exam_part: FCE_CLOZE_PART,
            bank_group_id: input.groupId,
            ...toClozePlan(groups.data[0], items.data),
            framing_text: await framing(),
          },
        },
      ]
    : [];

  const turn = await recordTurn({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    messages: [
      ...planMessages,
      ...results.map((r) => ({
        role: 'user' as const,
        msgType: 'text' as const,
        contentText: null,
        contentJson: { kind: 'cloze_answer', gap_number: r.number, chosen: r.chosen, isCorrect: r.isCorrect },
      })),
    ],
  });
  if (!turn.ok) return turn;

  const finished = await finishSession({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    evaluation: { kind: 'cloze_evaluation', score: correctCount, score_max: total, results },
  });
  if (!finished.ok) return finished;

  return ok({ sessionId: session.data.sessionId, correctCount, total, results });
}
