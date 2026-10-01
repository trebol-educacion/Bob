import type { Db } from './env';
import type { AudioPlan } from './audio';
import type { Payload } from './schemas';
import { itemVariantId } from './variant';

const FRAMEWORK = 'cambridge';
const EXAM = 'fce';
const CEFR = 'b2';

/**
 * @param db
 * @param examPart
 * @returns variant ids already stored for the part
 */
export async function existingVariants(db: Db, examPart: string): Promise<Set<string>> {
  const table = examPart === 'fce_listening_part1' ? 'closed_items' : 'item_groups';
  const column = table === 'closed_items' ? 'framework' : 'exam';
  const value = table === 'closed_items' ? FRAMEWORK : EXAM;
  const { data, error } = await db.from(table).select('variant_id').eq(column, value).eq('exam_part', examPart).eq('cefr_level', CEFR);
  if (error) throw new Error(`Listing ${examPart} failed: ${error.message}`);
  const ids = (data ?? []).map((row) => String(row.variant_id));
  if (table === 'item_groups') return new Set(ids);
  return new Set(ids.map((id) => id.replace(/-q\d+$/, '')));
}

/**
 * @param examPart
 * @returns skill of the part
 */
export function skillOf(examPart: string): 'reading' | 'listening' {
  return examPart.includes('listening') ? 'listening' : 'reading';
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
    status: 'enabled',
  }));
  const { error } = await db.from('closed_items').upsert(rows, { onConflict: 'framework,exam_part,cefr_level,variant_id' });
  if (error) throw new Error(`Items upsert failed: ${error.message}`);
  return rows.length;
}
