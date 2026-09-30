import 'server-only';

import { fetchGroupItems, fetchGroups } from '@/actions/item-bank/repository';
import { createSessionAction } from '@/actions/sessions';
import { persistMessage, readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { createSupabaseServer } from '@/lib/supabase/server';
import { pickGroup } from '@/lib/reading/pick-group';
import { gradeGroupAnswers, type AnswerMatcher } from './group-grading';
import { toGroupPayload } from './group-payload';
import { restoreGroupSession } from './group-restore';
import {
  GROUP_EVALUATION_KIND,
  GROUP_PLAN_KIND,
  type GroupAnswers,
  type GroupExercisePayload,
  type GroupStartResult,
  type GroupSubmitOutcome,
} from './group-types';
import type { ItemBankSkill } from './types';

export interface GroupPartConfig {
  mode: string;
  examPart: string;
  skill: ItemBankSkill;
  title: string;
  matcher: AnswerMatcher;
}

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

async function loadRandomExercise(config: GroupPartConfig, userId: string): Promise<GroupExercisePayload | null> {
  const groups = await fetchGroups({
    exam: 'fce',
    skill: config.skill,
    cefr_level: 'b2',
    exam_part: config.examPart,
    status: 'published',
  });
  if (!groups.ok) return null;

  const group = pickGroup(groups.data, await recentGroupIds(config.examPart, userId));
  if (!group) return null;
  const items = await fetchGroupItems([group.id]);
  if (!items.ok || items.data.length === 0) return null;

  return toGroupPayload(group, items.data);
}

export async function startGroupSession(config: GroupPartConfig): Promise<GroupStartResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const exercise = await loadRandomExercise(config, user.id);
  if (!exercise) return { error: 'Could not load exercise' };

  const session = await createSessionAction({ mode: config.mode, title: config.title });
  if (!session.data) return { error: session.error ?? 'Could not create session' };

  const saved = await persistMessage({
    sessionId: session.data.id,
    userId: session.data.user_id,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: { kind: GROUP_PLAN_KIND, exam_part: config.examPart, exercise },
  });
  if ('error' in saved) return { error: 'Could not save exercise' };

  return { session_id: session.data.id, exercise };
}

export async function submitGroupSession(
  config: GroupPartConfig,
  sessionId: string,
  answers: GroupAnswers,
): Promise<GroupSubmitOutcome> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const messages = await readSessionMessagesForCurrentOrUser(sessionId, user.id);
  const restored = restoreGroupSession(messages);
  if (!restored) return { error: 'Could not load exercise' };
  if (restored.result) return restored.result;

  const items = await fetchGroupItems([restored.exercise.groupId]);
  if (!items.ok || items.data.length === 0) return { error: 'Could not load exercise' };

  const graded = gradeGroupAnswers(items.data, answers, config.matcher);

  const saved = await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: GROUP_EVALUATION_KIND,
      exam_part: config.examPart,
      score: graded.correct,
      score_max: graded.total,
      score_10: graded.score_10,
      results: graded.results,
      answers,
      is_final: true,
    },
  });
  if ('error' in saved) return { error: 'Could not save result' };

  return graded;
}
