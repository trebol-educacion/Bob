import type { Db } from '../b2-pregen/env';
import type { PlanPart } from './types';

export interface PlanSlots {
  all: Set<string>;
  published: Set<string>;
  labels: string[];
}

/**
 * @param part
 * @param slot
 * @returns deterministic group variant id
 */
export function planVariant(part: PlanPart, slot: number): string {
  return `gen-${part.short}-${String(slot).padStart(3, '0')}`;
}

function slotOf(variant: string): number {
  const match = variant.match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/**
 * @param db
 * @param part
 * @returns variants stored for the part, which of them are published and their labels
 */
export async function planSlots(db: Db, part: PlanPart): Promise<PlanSlots> {
  const { data, error } = await db
    .from('item_groups')
    .select('variant_id, status, metadata')
    .eq('exam', part.exam)
    .eq('exam_part', part.examPart)
    .eq('cefr_level', part.cefr);
  if (error) throw new Error(`Listing ${part.examPart} failed: ${error.message}`);
  const slots: PlanSlots = { all: new Set(), published: new Set(), labels: [] };
  for (const row of data ?? []) {
    const variant = String(row.variant_id);
    slots.all.add(variant);
    if (row.status !== 'published') continue;
    slots.published.add(variant);
    const label = (row.metadata as Record<string, unknown> | null)?.label;
    if (typeof label === 'string' && label) slots.labels.push(label);
  }
  return slots;
}

/**
 * @param slots
 * @returns next free slot number, never reusing retired slots
 */
export function nextSlot(slots: PlanSlots): number {
  return Math.max(0, ...[...slots.all].map(slotOf)) + 1;
}

/**
 * @param db
 * @param part
 * @param variant
 * @param plan validated plan with its asset URLs
 * @param topic
 * @param label human label used to avoid repeats across sets
 * @returns resolves once the set is published
 */
export async function persistPlan(db: Db, part: PlanPart, variant: string, plan: unknown, topic: string, label: string): Promise<void> {
  const { error } = await db.from('item_groups').upsert(
    {
      exam: part.exam,
      skill: part.skill,
      cefr_level: part.cefr,
      purpose: 'practice',
      exam_part: part.examPart,
      variant_id: variant,
      stimulus_text: null,
      stimulus_audio_url: null,
      metadata: { plan, topic, label },
      source: 'generated',
      status: 'published',
    },
    { onConflict: 'exam,exam_part,cefr_level,variant_id' },
  );
  if (error) throw new Error(`Plan upsert failed: ${error.message}`);
}

/**
 * @param db
 * @param part
 * @param variant
 * @returns resolves once the set is retired
 */
export async function retirePlan(db: Db, part: PlanPart, variant: string): Promise<void> {
  const { error } = await db
    .from('item_groups')
    .update({ status: 'retired' })
    .eq('exam', part.exam)
    .eq('exam_part', part.examPart)
    .eq('cefr_level', part.cefr)
    .eq('variant_id', variant);
  if (error) throw new Error(`Retiring ${variant} failed: ${error.message}`);
}
