'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { createSessionAction } from '@/actions/sessions';
import { fetchGroupItems, fetchGroups } from '@/actions/item-bank/repository';
import { persistMessage } from '@/lib/persist-activity';
import { gradeExercise } from '@/lib/reading/fce-grouped-grading';
import { toPublicExercise } from '@/lib/reading/fce-grouped-public';
import { pickGroup } from '@/lib/reading/pick-group';
import {
  isFCEGroupedPart,
  type FCEGroupedPart,
  type FCEGroupedStartResult,
  type FCEGroupedSubmitResult,
} from '@/lib/reading/fce-grouped-types';

const RECENT_PLANS_WINDOW = 20;

const SESSION_TITLES: Record<FCEGroupedPart, string> = {
  fce_reading_part2: 'Reading Part 2, Open Cloze',
  fce_reading_part3: 'Reading Part 3, Word Formation',
  fce_reading_part4: 'Reading Part 4, Key Word Transformation',
  fce_reading_part5: 'Reading Part 5, Multiple Choice',
  fce_reading_part6: 'Reading Part 6, Gapped Text',
};

async function recentGroupIds(part: FCEGroupedPart, userId: string): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('messages')
    .select('content_json')
    .eq('user_id', userId)
    .eq('content_json->>kind', 'fce_grouped_plan')
    .eq('content_json->>part', part)
    .order('created_at', { ascending: false })
    .limit(RECENT_PLANS_WINDOW);
  if (error || !data) return [];
  return data
    .map((row) => (row.content_json as { exercise?: { groupId?: string } } | null)?.exercise?.groupId)
    .filter((id): id is string => typeof id === 'string');
}

async function hasFinalEvaluation(sessionId: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('session_id', sessionId)
    .eq('content_json->>kind', 'fce_grouped_evaluation')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function startFCEReadingExerciseAction(input: {
  part: string;
}): Promise<FCEGroupedStartResult | { error: string }> {
  if (!isFCEGroupedPart(input.part)) return { error: 'Unsupported part' };
  const part = input.part;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const groups = await fetchGroups({
    exam: 'fce',
    skill: 'reading',
    cefr_level: 'b2',
    exam_part: part,
    status: 'published',
  });
  if (!groups.ok) return { error: 'Could not load exercise' };

  const group = pickGroup(groups.data, await recentGroupIds(part, user.id));
  if (!group) return { error: 'No exercise available' };

  const items = await fetchGroupItems([group.id]);
  if (!items.ok || items.data.length === 0) return { error: 'Could not load exercise' };

  const exercise = toPublicExercise(part, group, items.data);

  const session = await createSessionAction({
    mode: `cambridge_${part}`,
    title: SESSION_TITLES[part],
  });
  if (!session.data) return { error: session.error ?? 'Could not create session' };

  await persistMessage({
    sessionId: session.data.id,
    userId: user.id,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: { kind: 'fce_grouped_plan', part, exercise },
  });

  return { sessionId: session.data.id, exercise };
}

export async function submitFCEReadingExerciseAction(input: {
  sessionId: string;
  part: string;
  groupId: string;
  answers: Record<number, string>;
}): Promise<FCEGroupedSubmitResult | { error: string }> {
  if (!isFCEGroupedPart(input.part)) return { error: 'Unsupported part' };
  const part = input.part;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', input.sessionId)
    .eq('user_id', user.id)
    .eq('mode', `cambridge_${part}`)
    .maybeSingle();
  if (!session) return { error: 'Session not found' };
  if (await hasFinalEvaluation(input.sessionId)) return { error: 'Already submitted' };

  const groups = await fetchGroups({ id: input.groupId, exam_part: part, status: 'published' });
  if (!groups.ok || groups.data.length === 0) return { error: 'Exercise not found' };
  const items = await fetchGroupItems([input.groupId]);
  if (!items.ok || items.data.length === 0) return { error: 'Exercise not found' };

  const graded = gradeExercise(part, items.data, input.answers);

  await persistMessage({
    sessionId: input.sessionId,
    userId: user.id,
    role: 'user',
    msgType: 'text',
    contentText: null,
    contentJson: { kind: 'fce_grouped_answers', part, answers: input.answers },
  });
  await persistMessage({
    sessionId: input.sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'fce_grouped_evaluation',
      part,
      score: graded.correct,
      score_max: graded.total,
      score_10: graded.score10,
      results: graded.results,
      is_final: true,
    },
  });

  return graded;
}
