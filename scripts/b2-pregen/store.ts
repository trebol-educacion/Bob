import type { Db } from './env';
import type { AudioPlan } from './audio';
import type { Payload } from './schemas';
import { normalizeTitle } from './semantic-rules';
import { itemVariantId } from './variant';

const FRAMEWORK = 'cambridge';
const EXAM = 'fce';
const CEFR = 'b2';

export interface SlotState {
  all: Set<string>;
  published: Set<string>;
  titles: Set<string>;
}

function stripItemSuffix(id: string): string {
  return id.replace(/-q\d+$/, '');
}

/**
 * @param db
 * @param examPart
 * @returns variants stored for the part, which of them are published and their normalized titles
 */
export async function slotState(db: Db, examPart: string): Promise<SlotState> {
  const state: SlotState = { all: new Set(), published: new Set(), titles: new Set() };
  if (examPart === 'fce_listening_part1') {
    const { data, error } = await db
      .from('closed_items')
      .select('variant_id, status')
      .eq('framework', FRAMEWORK)
      .eq('exam_part', examPart)
      .eq('cefr_level', CEFR)
      .eq('source', 'generated');
    if (error) throw new Error(`Listing ${examPart} failed: ${error.message}`);
    for (const row of data ?? []) {
      const variant = stripItemSuffix(String(row.variant_id));
      state.all.add(variant);
      if (row.status === 'published') state.published.add(variant);
    }
    return state;
  }
  const { data, error } = await db
    .from('item_groups')
    .select('variant_id, status, metadata')
    .eq('exam', EXAM)
    .eq('exam_part', examPart)
    .eq('cefr_level', CEFR);
  if (error) throw new Error(`Listing ${examPart} failed: ${error.message}`);
  for (const row of data ?? []) {
    const variant = String(row.variant_id);
    state.all.add(variant);
    if (row.status !== 'published') continue;
    state.published.add(variant);
    const title = (row.metadata as Record<string, unknown> | null)?.title;
    if (typeof title === 'string') state.titles.add(normalizeTitle(title));
  }
  return state;
}

/**
 * @param examPart
 * @returns skill of the part
 */
export function skillOf(examPart: string): 'reading' | 'listening' | 'writing' | 'speaking' {
  if (examPart.includes('listening')) return 'listening';
  if (examPart.includes('writing')) return 'writing';
  if (examPart.includes('speaking')) return 'speaking';
  return 'reading';
}

/**
 * @param db
 * @param examPart
 * @param variant group variant id
 * @returns resolves once the group and its items are retired
 */
export async function retireVariant(db: Db, examPart: string, variant: string): Promise<void> {
  if (examPart !== 'fce_listening_part1') {
    const { error } = await db
      .from('item_groups')
      .update({ status: 'retired' })
      .eq('exam', EXAM)
      .eq('exam_part', examPart)
      .eq('cefr_level', CEFR)
      .eq('variant_id', variant);
    if (error) throw new Error(`Retiring group ${variant} failed: ${error.message}`);
  }
  const { error } = await db
    .from('closed_items')
    .update({ status: 'retired' })
    .eq('framework', FRAMEWORK)
    .eq('exam_part', examPart)
    .eq('cefr_level', CEFR)
    .like('variant_id', `${variant}-q%`);
  if (error) throw new Error(`Retiring items ${variant} failed: ${error.message}`);
}

async function upsertGroup(
  db: Db,
  examPart: string,
  variant: string,
  payload: Payload,
  audio: AudioPlan,
): Promise<string | null> {
  if (!payload.group) return null;
  const { data, error } = await db
    .from('item_groups')
    .upsert(
      {
        exam: EXAM,
        skill: skillOf(examPart),
        cefr_level: CEFR,
        purpose: 'practice',
        exam_part: examPart,
        variant_id: variant,
        stimulus_text: payload.group.stimulus_text,
        stimulus_audio_url: audio.groupAudio,
        metadata: payload.group.metadata,
        source: 'generated',
        status: 'published',
      },
      { onConflict: 'exam,exam_part,cefr_level,variant_id' },
    )
    .select('id')
    .single();
  if (error || !data) throw new Error(`Group upsert failed: ${error?.message}`);
  return data.id as string;
}

/**
 * @param db
 * @param examPart
 * @param variant
 * @param payload
 * @param audio
 * @returns number of items written
 */
export async function persist(
  db: Db,
  examPart: string,
  variant: string,
  payload: Payload,
  audio: AudioPlan,
): Promise<number> {
  const groupId = await upsertGroup(db, examPart, variant, payload, audio);
  if (payload.items.length === 0) return 0;
  const rows = payload.items.map((item, index) => ({
    framework: FRAMEWORK,
    exam_part: examPart,
    cefr_level: CEFR,
    skill: skillOf(examPart),
    variant_id: itemVariantId(variant, index + 1),
    group_id: groupId,
    group_order: groupId ? index + 1 : null,
    question: item.question,
    options: item.options,
    correct_key: item.correct_key,
    explanation: item.explanation,
    transcript: item.transcript ?? null,
    stimulus_audio_url: audio.itemAudio[index],
    metadata: item.metadata,
    source: 'generated',
    status: 'published',
  }));
  const { error } = await db.from('closed_items').upsert(rows, { onConflict: 'framework,exam_part,cefr_level,variant_id' });
  if (error) throw new Error(`Items upsert failed: ${error.message}`);
  return rows.length;
}
