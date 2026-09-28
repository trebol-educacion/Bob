'use server';

import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { CHALLENGE_IMAGE_SLOTS, type ImageMap } from '@/lib/challenge/cambridge-a2';

const SLOT_KEYS = CHALLENGE_IMAGE_SLOTS.filter((s) => s.kind !== 'notice').map((s) => s.key);

/** Returns one randomly selected pre-generated image URL per generatable slot, keyed by slot key. */
export async function getChallengeImagesAction(): Promise<ImageMap> {
  try {
    const admin = createSupabaseAdmin();
    const { data: rows, error } = await admin
      .from('challenge_images')
      .select('slot_key, version, image_url')
      .in('slot_key', SLOT_KEYS);

    if (error || !rows) return {};

    const bySlot = new Map<string, { version: number; image_url: string }[]>();
    for (const row of rows) {
      if (!bySlot.has(row.slot_key)) bySlot.set(row.slot_key, []);
      bySlot.get(row.slot_key)!.push(row);
    }

    const result: ImageMap = {};
    for (const [slotKey, versions] of bySlot) {
      if (versions.length === 0) continue;
      const picked = versions[Math.floor(Math.random() * versions.length)];
      result[slotKey] = picked.image_url;
    }
    return result;
  } catch {
    return {};
  }
}
