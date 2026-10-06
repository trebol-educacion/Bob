import 'server-only';

import { fetchGroupItems, fetchGroups } from '@/actions/item-bank/repository';
import { readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { BankItem } from './types';
import { pickGroup } from '@/lib/reading/pick-group';
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

const RECENT_PLANS_WINDOW = 20;

async function recentGroupIds(examPart: string, userId: string): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('messages')
    .select('content_json')
    .eq('user_id', userId)
    .eq('content_json->>kind', GROUP_PLAN_KIND)
    .eq('content_json->>exam_part', examPart)
    .order('created_at', { ascending: false })
    .limit(RECENT_PLANS_WINDOW);
  if (error || !data) return [];
  return data
    .map((row) => (row.content_json as { exercise?: { groupId?: string } } | null)?.exercise?.groupId)
    .filter((id): id is string => typeof id === 'string');
}

async function loadExercise<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
  userId: string,
): Promise<E | { error: string }> {
  const groups = await fetchGroups({
    exam: 'fce',
    skill: strategy.skill,
    cefr_level: 'b2',
    exam_part: strategy.examPart,
    status: 'published',
  });
  if (!groups.ok) return { error: 'Could not load exercise' };

  const group = pickGroup(groups.data, await recentGroupIds(strategy.examPart, userId));
  if (!group) return { error: 'No exercise available' };
  const items = await fetchGroupItems([group.id]);
  if (!items.ok || items.data.length === 0) return { error: 'Could not load exercise' };

  return strategy.toPublic(group, items.data);
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
