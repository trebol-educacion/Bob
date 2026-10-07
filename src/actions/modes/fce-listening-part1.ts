'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { pickContent } from '@/lib/item-bank/content-source';
import { readSessionMessages } from '@/lib/persist-activity';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';

const ITEMS_PER_SESSION = 8;
const FCE_LISTENING_P1_MODE = 'cambridge_fce_listening_part1';

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
  sessionId: string;
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

function keyToIndex(key: string): number {
  return key.charCodeAt(0) - 'A'.charCodeAt(0);
}

function toPlanItem(item: RawClosedItem) {
  return {
    id: item.id,
    variant_id: item.variant_id,
    stimulus_audio_url: item.stimulus_audio_url ?? '',
    question: item.question,
    options: item.options.map((o) => o.label),
    correct_index: keyToIndex(item.correct_key),
  };
}

/** Picks 8 random items from the bank without touching the session tables. */
export async function startFCEListeningPart1Action(): Promise<
  { items: FCEShortExtractsItem[] } | { error: string }
> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const picked = await pickContent({
    framework: 'fce',
    cefr: 'b2',
    examPart: 'fce_listening_part1',
    purpose: 'practice',
    skill: 'listening',
    userId: user.id,
    count: ITEMS_PER_SESSION,
  });
  if (!picked.ok) return { error: 'Could not load listening items' };

  const pool = picked.data.items;

  const clientItems: FCEShortExtractsItem[] = pool.map((item) => ({
    id: item.id,
    variant_id: item.variant_id,
    stimulus_audio_url: item.stimulus_audio_url ?? '',
    question: item.question,
    options: item.options.map((o) => o.label),
  }));

  return { items: clientItems };
}

async function loadPlanItems(itemIds: string[]): Promise<RawClosedItem[] | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('closed_items')
    .select('id, variant_id, stimulus_audio_url, question, options, correct_key')
    .in('id', itemIds);
  if (error || !data) return null;
  const byId = new Map((data as RawClosedItem[]).map((row) => [row.id, row]));
  const ordered = itemIds.map((id) => byId.get(id));
  return ordered.every(Boolean) ? (ordered as RawClosedItem[]) : null;
}

/**
 * Validates a single answer server-side. The first answer creates the session and
 * persists the plan, so closing the activity before answering leaves no trace.
 */
export async function submitFCEListeningAnswerAction(input: {
  sessionId?: string;
  itemIds: string[];
  itemId: string;
  selectedIndex: number;
}): Promise<FCEListeningTurnResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: item, error: itemError } = await supabase
    .from('closed_items')
    .select('correct_key')
    .eq('id', input.itemId)
    .single();

  if (itemError || !item) return { error: 'Item not found' };

  const correct_index = keyToIndex((item as { correct_key: string }).correct_key);
  const correct = input.selectedIndex === correct_index;

  const session = await ensureSession({ mode: FCE_LISTENING_P1_MODE, sessionId: input.sessionId });
  if (!session.ok) return { error: session.code };

  const planMessages = [];
  if (session.data.created) {
    const planItems = await loadPlanItems(input.itemIds);
    if (!planItems) return { error: 'Could not load listening items' };
    planMessages.push({
      role: 'bob' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: { kind: 'fce_listening_part1_plan', items: planItems.map(toPlanItem) },
    });
  }

  const turn = await recordTurn({
    sessionId: session.data.sessionId,
    userId: session.data.userId,
    messages: [
      ...planMessages,
      {
        role: 'user',
        msgType: 'text',
        contentText: null,
        contentJson: { kind: 'fce_listening_answer', item_id: input.itemId, selected_index: input.selectedIndex },
      },
      {
        role: 'bob',
        msgType: 'evaluation',
        contentText: null,
        contentJson: {
          kind: 'fce_listening_turn_result',
          item_id: input.itemId,
          selected_index: input.selectedIndex,
          correct_index,
          correct,
          is_final: false,
        },
      },
    ],
  });
  if (!turn.ok) return { error: turn.code };

  return { sessionId: session.data.sessionId, correct, correct_index };
}

/** Counts the persisted correct turns, writes the final evaluation and the activity result. */
export async function finalizeFCEListeningSessionAction(
  session_id: string
): Promise<FCEListeningFinalResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const messages = await readSessionMessages(session_id, user.id);
  const score = messages.filter((m) => {
    const cj = m.content_json as Record<string, unknown> | null;
    return m.msg_type === 'evaluation' && cj?.kind === 'fce_listening_turn_result' && cj.correct === true;
  }).length;

  const finished = await finishSession({
    sessionId: session_id,
    userId: user.id,
    evaluation: { kind: 'fce_listening_final', score, score_max: ITEMS_PER_SESSION },
  });
  if (!finished.ok) return { error: finished.code };

  return { score, score_max: ITEMS_PER_SESSION };
}
