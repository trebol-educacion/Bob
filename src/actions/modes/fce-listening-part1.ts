'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { createSessionAction } from '@/actions/sessions';
import { persistMessage, persistMessages } from '@/lib/persist-activity';

const ITEMS_PER_SESSION = 8;

/** A single FCE Listening Part 1 item exposed to the client (no correct_key). */
export interface FCEShortExtractsItem {
  id: string;
  variant_id: string;
  stimulus_audio_url: string;
  question: string;
  options: string[];
}

/** Result for a single answered turn. */
export interface FCEListeningTurnResult {
  correct: boolean;
  correct_index: number;
}

/** Result returned after finalizing the session. */
export interface FCEListeningFinalResult {
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

function keyToIndex(key: string): number {
  return key.charCodeAt(0) - 'A'.charCodeAt(0);
}

/**
 * Starts a new FCE Listening Part 1 session.
 * Picks 8 random items from the bank, creates a bob_sessions row,
 * and persists an initial plan message.
 */
export async function startFCEListeningPart1Action(): Promise<
  { session_id: string; items: FCEShortExtractsItem[] } | { error: string }
> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: rows, error: fetchError } = await supabase
    .from('closed_items')
    .select('id, variant_id, stimulus_audio_url, question, options, correct_key')
    .eq('framework', 'cambridge')
    .eq('exam_part', 'fce_listening_part1')
    .eq('cefr_level', 'b2')
    .eq('skill', 'listening')
    .eq('status', 'enabled');

  if (fetchError || !rows || rows.length === 0) {
    return { error: 'Could not load listening items' };
  }

  const pool = shuffleInPlace([...(rows as RawClosedItem[])]).slice(0, ITEMS_PER_SESSION);

  const sessionResult = await createSessionAction({
    mode: 'cambridge_fce_listening_part1',
    title: 'Listening Part 1 — Short Extracts',
  });

  if (!sessionResult.data) {
    return { error: sessionResult.error ?? 'Could not create session' };
  }

  const sessionId = sessionResult.data.id;
  const userId = sessionResult.data.user_id;

  const planJson = {
    kind: 'fce_listening_part1_plan',
    items: pool.map((item) => ({
      id: item.id,
      variant_id: item.variant_id,
      stimulus_audio_url: item.stimulus_audio_url ?? '',
      question: item.question,
      options: (item.options as Array<{ key: string; label: string }>).map((o) => o.label),
      correct_index: keyToIndex(item.correct_key),
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

  const clientItems: FCEShortExtractsItem[] = pool.map((item) => ({
    id: item.id,
    variant_id: item.variant_id,
    stimulus_audio_url: item.stimulus_audio_url ?? '',
    question: item.question,
    options: (item.options as Array<{ key: string; label: string }>).map((o) => o.label),
  }));

  return { session_id: sessionId, items: clientItems };
}

/**
 * Validates a single answer server-side and persists both the user answer
 * and Bob's per-turn evaluation message.
 * The correct_index is derived server-side — never sent to the client upfront.
 */
export async function submitFCEListeningAnswerAction(
  session_id: string,
  item_id: string,
  selected_index: number
): Promise<FCEListeningTurnResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: item, error: itemError } = await supabase
    .from('closed_items')
    .select('correct_key')
    .eq('id', item_id)
    .single();

  if (itemError || !item) return { error: 'Item not found' };

  const correct_index = keyToIndex((item as { correct_key: string }).correct_key);
  const correct = selected_index === correct_index;

  persistMessages([
    {
      sessionId: session_id,
      userId: user.id,
      role: 'user',
      msgType: 'text',
      contentText: null,
      contentJson: {
        kind: 'fce_listening_answer',
        item_id,
        selected_index,
      },
    },
    {
      sessionId: session_id,
      userId: user.id,
      role: 'bob',
      msgType: 'evaluation',
      contentText: null,
      contentJson: {
        kind: 'fce_listening_turn_result',
        item_id,
        selected_index,
        correct_index,
        correct,
        is_final: false,
      },
    },
  ]).catch(() => undefined);

  return { correct, correct_index };
}

/**
 * Computes the final score and persists the session-closing evaluation message.
 * Called once after all 8 turns are completed.
 */
export async function finalizeFCEListeningSessionAction(
  session_id: string,
  correct_count: number
): Promise<FCEListeningFinalResult | { error: string }> {
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
      kind: 'fce_listening_final',
      score: correct_count,
      score_max,
      is_final: true,
    },
  }).catch(() => undefined);

  return { score: correct_count, score_max };
}
