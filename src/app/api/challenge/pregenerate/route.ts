import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { generateImageWithFallback } from '@/lib/yl-imagen';
import { CHALLENGE_IMAGE_SLOTS } from '@/lib/challenge/cambridge-a2';
import { buildChallengePrompt, challengeStoragePath } from '@/lib/challenge/image-gen';

const GENERATABLE_SLOTS = CHALLENGE_IMAGE_SLOTS.filter((s) => s.kind !== 'notice');
const CHUNK_SIZE = 6;

/**
 * Generates missing versioned challenge images and stores them in Supabase.
 * Idempotent — existing (slot_key, version) rows are never regenerated,
 * making it safe to re-run when a Vercel function times out mid-batch.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetVersions = Math.max(1, parseInt(searchParams.get('versions') ?? '10', 10));
  const slotFilter = searchParams.get('slot');

  const slots = slotFilter
    ? GENERATABLE_SLOTS.filter((s) => s.key === slotFilter)
    : GENERATABLE_SLOTS;

  const admin = createSupabaseAdmin();

  const { data: existingRows } = await admin
    .from('challenge_images')
    .select('slot_key, version')
    .in('slot_key', slots.map((s) => s.key));

  const existingMap = new Map<string, Set<number>>();
  for (const row of existingRows ?? []) {
    if (!existingMap.has(row.slot_key)) existingMap.set(row.slot_key, new Set());
    existingMap.get(row.slot_key)!.add(row.version);
  }

  type Task = { slot: (typeof slots)[number]; version: number };
  const tasks: Task[] = [];

  for (const slot of slots) {
    const existing = existingMap.get(slot.key) ?? new Set<number>();
    for (let v = 1; v <= targetVersions; v++) {
      if (!existing.has(v)) tasks.push({ slot, version: v });
    }
  }

  let generated = 0;
  let skipped = tasks.length === 0 ? slots.length * targetVersions - tasks.length : 0;
  let failed = 0;

  const totalExisting = [...existingMap.values()].reduce((acc, s) => acc + s.size, 0);
  skipped = totalExisting;

  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async ({ slot, version }) => {
        try {
          const prompt = buildChallengePrompt(slot.description, slot.kind);
          const pixels = await generateImageWithFallback(`challenge-${slot.key}-v${version}`, prompt);
          if (!pixels) {
            failed++;
            return;
          }
          const path = challengeStoragePath(slot.key, version);
          const bytes = Buffer.from(pixels.b64, 'base64');
          const { error: uploadErr } = await admin.storage
            .from('bob-images')
            .upload(path, bytes, { contentType: pixels.mime, upsert: true });
          if (uploadErr) {
            failed++;
            return;
          }
          const { data: pub } = admin.storage.from('bob-images').getPublicUrl(path);
          const { error: insertErr } = await admin
            .from('challenge_images')
            .insert({ slot_key: slot.key, version, image_url: pub.publicUrl });
          if (insertErr && !insertErr.message.includes('unique')) {
            failed++;
            return;
          }
          generated++;
        } catch {
          failed++;
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    generated,
    skipped,
    failed,
    totalSlots: slots.length,
  });
}
