import 'server-only';

import { fetchGroupItems, fetchGroups } from '@/actions/item-bank/repository';
import { createSessionAction } from '@/actions/sessions';
import { persistMessage, readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { createSupabaseServer } from '@/lib/supabase/server';
import { pickGroup } from '@/lib/reading/pick-group';
import { restoreGroupSession } from './group-restore';
import {
  GROUP_EVALUATION_KIND,
  GROUP_PLAN_KIND,
  type GroupSessionStrategy,
  type GroupStartOutcome,
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
 * @returns new session with the persisted public plan
 */
export async function startGroupSession<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
): Promise<GroupStartOutcome<E>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const exercise = await loadExercise(strategy, user.id);
  if ('error' in exercise) return exercise;

  const session = await createSessionAction({ mode: strategy.mode, title: strategy.title });
  if (!session.data) return { error: session.error ?? 'Could not create session' };

  const saved = await persistMessage({
    sessionId: session.data.id,
    userId: session.data.user_id,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: { kind: GROUP_PLAN_KIND, exam_part: strategy.examPart, exercise },
  });
  if ('error' in saved) return { error: 'Could not save exercise' };

  return { sessionId: session.data.id, exercise };
}

/**
 * @template E
 * @template A
 * @template R
 * @param strategy
 * @param sessionId
 * @param answers
 * @returns graded result persisted as final, or the stored one on resubmission
 */
export async function submitGroupSession<E extends { groupId: string }, A, R>(
  strategy: GroupSessionStrategy<E, A, R>,
  sessionId: string,
  answers: A,
): Promise<GroupSubmitOutcome<R>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const messages = await readSessionMessagesForCurrentOrUser(sessionId, user.id);
  const restored = restoreGroupSession<E, R>(messages, strategy.examPart);
  if (!restored) return { error: 'Could not load exercise' };
  if (restored.result) return restored.result;

  const items = await fetchGroupItems([restored.exercise.groupId]);
  if (!items.ok || items.data.length === 0) return { error: 'Could not load exercise' };

  const graded = strategy.grade(items.data, answers);
  const summary = strategy.summarize(graded);

  const saved = await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: GROUP_EVALUATION_KIND,
      exam_part: strategy.examPart,
      score: summary.correct,
      score_max: summary.total,
      score_10: summary.score10,
      result: graded,
      answers,
      is_final: true,
    },
  });
  if ('error' in saved) return { error: 'Could not save result' };

  return graded;
}
