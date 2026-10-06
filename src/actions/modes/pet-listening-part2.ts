'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { currentUserId, openSession, recordTurn, finishSession } from '@/lib/session/lifecycle';
import { readSessionMessages } from '@/lib/persist-activity';
import { pickContent } from '@/lib/item-bank/content-source';

const ITEMS_PER_SESSION = 6;
const MODE = 'cambridge_pet_listening_part2';

interface PlanItem {
  id: string;
  variant_id: string;
  stimulus_audio_url: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  correct_key: string;
}

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
  sessionId: string;
  correct: boolean;
  correct_key: string;
}

/** Result returned after finalizing the session. */
export interface PETListeningFinalResult {
  score: number;
  score_max: number;
}

/**
 * Picks 6 items from the bank; persists nothing, the session is created on the first answer.
 */
export async function startPETListeningPart2Action(): Promise<{ items: PETListeningItem[] } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Not authenticated' };

  const picked = await pickContent({
    framework: 'pet',
    cefr: 'b1',
    examPart: 'pet_listening_part2',
    purpose: 'practice',
    skill: 'listening',
    userId,
    count: ITEMS_PER_SESSION,
  });
  if (!picked.ok) return { error: 'Could not load listening items' };

  const clientItems: PETListeningItem[] = picked.data.items.map((item) => ({
    id: item.id,
    variant_id: item.variant_id,
    stimulus_audio_url: item.stimulus_audio_url ?? '',
    question: item.question,
    options: item.options,
  }));

  return { items: clientItems };
}

async function loadPlanItems(itemIds: string[]): Promise<PlanItem[] | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('closed_items')
    .select('id, variant_id, stimulus_audio_url, question, options, correct_key')
    .in('id', itemIds);
  if (error || !data || data.length !== itemIds.length) return null;
  const byId = new Map((data as Array<PlanItem & { stimulus_audio_url: string | null }>).map((row) => [row.id, row]));
  const ordered: PlanItem[] = [];
  for (const id of itemIds) {
    const row = byId.get(id);
    if (!row) return null;
    ordered.push({ ...row, stimulus_audio_url: row.stimulus_audio_url ?? '' });
  }
  return ordered;
}

/**
 * Validates a single answer server-side; the first answer creates the session with the plan rebuilt from the item ids.
 * The correct_key is never sent to the client before the answer.
 */
export async function submitPETListeningAnswerAction(input: {
  sessionId?: string;
  itemIds: string[];
  itemId: string;
  selectedKey: string;
}): Promise<PETListeningTurnResult | { error: string }> {
  if (!input.itemIds.includes(input.itemId)) return { error: 'Item not found' };

  const planItems = await loadPlanItems(input.itemIds);
  if (!planItems) return { error: 'Item not found' };
  const item = planItems.find((candidate) => candidate.id === input.itemId);
  if (!item) return { error: 'Item not found' };

  const correct = input.selectedKey === item.correct_key;

  const session = await openSession({
    mode: MODE,
    sessionId: input.sessionId,
    opening: [
      { role: 'bob', msgType: 'text', contentText: null, contentJson: { kind: 'pet_listening_part2_plan', items: planItems } },
    ],
  });
  if (!session.ok) return { error: session.code };

  const turn = await recordTurn({
    ...session.data,
    messages: [
      {
        role: 'user',
        msgType: 'text',
        contentText: null,
        contentJson: { kind: 'pet_listening_answer', item_id: input.itemId, selected_key: input.selectedKey },
      },
      {
        role: 'bob',
        msgType: 'evaluation',
        contentText: null,
        contentJson: {
          kind: 'pet_listening_turn_result',
          item_id: input.itemId,
          selected_key: input.selectedKey,
          correct_key: item.correct_key,
          correct,
          is_final: false,
        },
      },
    ],
  });
  if (!turn.ok) return { error: turn.code };

  return { sessionId: session.data.sessionId, correct, correct_key: item.correct_key };
}

/**
 * Counts the correct turns stored in the session and closes it with the canonical grade.
 * Called once after all 6 turns are completed.
 */
export async function finalizePETListeningSessionAction(input: {
  sessionId: string;
}): Promise<PETListeningFinalResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'Not authenticated' };

  const messages = await readSessionMessages(input.sessionId, userId);
  const correctItems = new Set<string>();
  for (const message of messages) {
    const json = message.content_json as { kind?: string; item_id?: string; correct?: boolean } | null;
    if (json?.kind === 'pet_listening_turn_result' && json.correct === true && json.item_id) correctItems.add(json.item_id);
  }

  const score = correctItems.size;
  const score_max = ITEMS_PER_SESSION;
  const finished = await finishSession({
    sessionId: input.sessionId,
    userId,
    evaluation: { kind: 'pet_listening_final', score, score_max },
  });
  if (!finished.ok) return { error: finished.code };

  return { score, score_max };
}
