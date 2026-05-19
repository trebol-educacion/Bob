'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { createSessionAction } from '@/actions/sessions';
import { persistMessage, persistMessages } from '@/lib/persist-activity';

const ITEMS_PER_SESSION = 6;

/** A single PET Listening Part 2 item exposed to the client (no correct_key). */
export interface PETListeningItem {
  id: string;
  variant_id: string;
  stimulus_audio_url: string;
  question: string;
  options: Array<{ key: string; label: string }>;
}

/** Result for a single answered turn. */
export interface PETListeningTurnResult {
  correct: boolean;
  correct_key: string;
}

/** Result returned after finalizing the session. */
export interface PETListeningFinalResult {
  score: number;
  score_max: number;
}

interface RawClosedItem {
  id: string;
  variant_id: string;
  stimulus_audio_url: string | null;
  question: string;
  options: Array<{ key: string; label: string }>;
  correct_key: string;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Starts a new PET Listening Part 2 session.
 * Picks 6 random items from the bank, creates a bob_sessions row,
 * and persists an initial plan message.
 */
export async function startPETListeningPart2Action(): Promise<
  { session_id: string; items: PETListeningItem[] } | { error: string }
> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: rows, error: fetchError } = await supabase
    .from('bob_closed_items')
    .select('id, variant_id, stimulus_audio_url, question, options, correct_key')
    .eq('framework', 'cambridge')
    .eq('exam_part', 'pet_listening_part2')
    .eq('cefr_level', 'b1')
    .eq('skill', 'listening')
    .eq('status', 'enabled');

  if (fetchError || !rows || rows.length === 0) {
    return { error: 'Could not load listening items' };
  }

  const pool = shuffleInPlace([...(rows as RawClosedItem[])]).slice(0, ITEMS_PER_SESSION);

  const sessionResult = await createSessionAction({
    mode: 'cambridge_pet_listening_part2',
    title: 'PET Listening Part 2 — Multiple Choice',
  });

  if (!sessionResult.data) {
    return { error: sessionResult.error ?? 'Could not create session' };
  }

  const sessionId = sessionResult.data.id;
  const userId = sessionResult.data.user_id;

  const planJson = {
    kind: 'pet_listening_part2_plan',
    items: pool.map((item) => ({
      id: item.id,
      variant_id: item.variant_id,
      stimulus_audio_url: item.stimulus_audio_url ?? '',
      question: item.question,
      options: item.options,
      correct_key: item.correct_key,
    })),
  };

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: planJson,
  }).catch(() => undefined);

  const clientItems: PETListeningItem[] = pool.map((item) => ({
    id: item.id,
    variant_id: item.variant_id,
    stimulus_audio_url: item.stimulus_audio_url ?? '',
    question: item.question,
    options: item.options,
  }));

  return { session_id: sessionId, items: clientItems };
}

/**
 * Validates a single answer server-side and persists both the user answer
 * and Bob's per-turn evaluation message.
 * The correct_key is never sent to the client — it is fetched here directly.
 */
export async function submitPETListeningAnswerAction(
  session_id: string,
  item_id: string,
  selected_key: string
): Promise<PETListeningTurnResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: item, error: itemError } = await supabase
    .from('bob_closed_items')
    .select('correct_key')
    .eq('id', item_id)
    .single();

  if (itemError || !item) return { error: 'Item not found' };

  const correct_key = (item as { correct_key: string }).correct_key;
  const correct = selected_key === correct_key;

  persistMessages([
    {
      sessionId: session_id,
      userId: user.id,
      role: 'user',
      msgType: 'text',
      contentText: null,
      contentJson: {
        kind: 'pet_listening_answer',
        item_id,
        selected_key,
      },
    },
    {
      sessionId: session_id,
      userId: user.id,
      role: 'bob',
      msgType: 'evaluation',
      contentText: null,
      contentJson: {
        kind: 'pet_listening_turn_result',
        item_id,
        selected_key,
        correct_key,
        correct,
        is_final: false,
      },
    },
  ]).catch(() => undefined);

  return { correct, correct_key };
}

/**
 * Computes the final score and persists the session-closing evaluation message.
 * Called once after all 6 turns are completed.
 */
export async function finalizePETListeningSessionAction(
  session_id: string,
  correct_count: number
): Promise<PETListeningFinalResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const score_max = ITEMS_PER_SESSION;

  persistMessage({
    sessionId: session_id,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'pet_listening_final',
      score: correct_count,
      score_max,
      is_final: true,
    },
  }).catch(() => undefined);

  return { score: correct_count, score_max };
}
