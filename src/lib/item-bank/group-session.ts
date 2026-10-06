import 'server-only';

import { fetchGroupItems, fetchGroups } from '@/actions/item-bank/repository';
import { pickContent } from './content-source';
import { readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { BankItem } from './types';
import { restoreGroupSession } from './group-restore';
import {
  GROUP_ANSWERS_KIND,
  GROUP_EVALUATION_KIND,
  GROUP_PLAN_KIND,
  type GroupSessionStrategy,
  type GroupStartOutcome,
  type GroupSubmitInput,
  type GroupSubmitOutcome,
} from './group-session-types';

async function loadExercise<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
  userId: string,
): Promise<E | { error: string }> {
  const picked = await pickContent({
    framework: strategy.exam,
    cefr: strategy.cefr,
    examPart: strategy.examPart,
    purpose: 'practice',
    skill: strategy.skill,
    userId,
    groupsOnly: true,
  });
  if (!picked.ok) return { error: picked.code === 'no_content' ? 'No exercise available' : 'Could not load exercise' };
  if (picked.data.kind !== 'group') return { error: 'No exercise available' };

  return strategy.toPublic(picked.data.group, picked.data.items);
}

/**
 * @template E
 * @template A
 * @template R
 * @param strategy
 * @returns public exercise; no session row is created until the first submit
 */
export async function startGroupSession<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
): Promise<GroupStartOutcome<E>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const exercise = await loadExercise(strategy, user.id);
  if ('error' in exercise) return exercise;

  return { exercise };
}

async function resolveGroupId<E extends { groupId: string }, R, A>(
  strategy: GroupSessionStrategy<E, A, R>,
  input: GroupSubmitInput<A>,
  userId: string,
): Promise<{ groupId: string; stored: R | null } | { error: string }> {
  if (!input.sessionId) return { groupId: input.groupId, stored: null };
  const messages = await readSessionMessagesForCurrentOrUser(input.sessionId, userId);
  const restored = restoreGroupSession<E, R>(messages, strategy.examPart);
  if (!restored) return { error: 'Could not load exercise' };
  return { groupId: restored.exercise.groupId, stored: restored.result };
}

async function buildPlanMessage<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
  groupId: string,
  items: BankItem[],
) {
  const groups = await fetchGroups({ id: groupId });
  if (!groups.ok || groups.data.length === 0) return null;
  return {
    role: 'bob' as const,
    msgType: 'text' as const,
    contentText: null,
    contentJson: { kind: GROUP_PLAN_KIND, exam_part: strategy.examPart, exercise: strategy.toPublic(groups.data[0], items) },
  };
}

/**
 * @template E
 * @template A
 * @template R
 * @param strategy
 * @param input session (optional on first submit), group and answers
 * @returns graded result persisted as final, or the stored one on resubmission
 */
export async function submitGroupSession<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
  input: GroupSubmitInput<A>,
): Promise<GroupSubmitOutcome<R>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const resolved = await resolveGroupId(strategy, input, user.id);
  if ('error' in resolved) return resolved;
  if (resolved.stored && input.sessionId) return { sessionId: input.sessionId, result: resolved.stored };

  const items = await fetchGroupItems([resolved.groupId]);
  if (!items.ok || items.data.length === 0) return { error: 'Could not load exercise' };

  const graded = strategy.grade(items.data, input.answers);
  const summary = strategy.summarize(graded);

  const session = await ensureSession({ mode: strategy.mode, sessionId: input.sessionId });
  if (!session.ok) return { error: 'Could not create session' };

  const plan = session.data.created ? await buildPlanMessage(strategy, resolved.groupId, items.data) : null;
  if (session.data.created && !plan) return { error: 'Could not load exercise' };

  const turn = await recordTurn({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    messages: [
      ...(plan ? [plan] : []),
      {
        role: 'user',
        msgType: 'text',
        contentText: null,
        contentJson: { kind: GROUP_ANSWERS_KIND, exam_part: strategy.examPart, answers: input.answers },
      },
    ],
  });
  if (!turn.ok) return { error: 'Could not save exercise' };

  const finished = await finishSession({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    evaluation: {
      kind: GROUP_EVALUATION_KIND,
      exam_part: strategy.examPart,
      score: summary.correct,
      score_max: summary.total,
      score_10: summary.score10,
      result: graded,
      answers: input.answers,
    },
  });
  if (!finished.ok) return { error: 'Could not save result' };

  return { sessionId: session.data.sessionId, result: graded };
}
