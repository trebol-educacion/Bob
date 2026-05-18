/**
 * Generates TTS audio files for all Assessment Listening items in bob_closed_items
 * and uploads them to Supabase Storage bucket `bob-listening`.
 *
 * Usage:
 *   bun run scripts/generate-listening-audio.ts
 *
 * Prerequisites:
 *   - GEMINI_API_KEY in .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *     (service role key needed to upload to storage without RLS)
 *
 * The script reads transcripts from bob_closed_items WHERE skill='listening',
 * generates audio via Gemini TTS (gemini-2.5-flash-preview-tts), and uploads
 * each file to Supabase Storage at the path stored in stimulus_audio_url.
 *
 * It is idempotent: items whose audio_url already exists in storage are skipped.
 *
 * Voice assignment strategy (from metadata.voice):
 *   child_male / child_female  → 'Zephyr' (lighter, younger timbre)
 *   teenager_male              → 'Charon'
 *   teenager_female            → 'Kore'
 *   adult_male                 → 'Orus'
 *   adult_female               → 'Aoede'
 *   adult_mixed                → alternates Orus / Aoede per item
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const BUCKET = 'bob-listening';

const VOICE_MAP: Record<string, string> = {
  child_male:     'Zephyr',
  child_female:   'Zephyr',
  teenager_male:  'Charon',
  teenager_female:'Kore',
  adult_male:     'Orus',
  adult_female:   'Aoede',
  adult_mixed:    'Orus',
};

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const { data: items, error } = await supabase
    .from('bob_closed_items')
    .select('id, variant_id, cefr_level, stimulus_audio_url, transcript, metadata')
    .eq('skill', 'listening')
    .eq('status', 'enabled')
    .not('transcript', 'is', null);

  if (error || !items) {
    console.error('Failed to fetch items:', error);
    process.exit(1);
  }

  console.log(`Found ${items.length} listening items to process.`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const audioPath = item.stimulus_audio_url as string;
    if (!audioPath) {
      console.warn(`[${item.variant_id}] No audio path — skipping.`);
      skipped++;
      continue;
    }

    const storagePath = audioPath.startsWith('/') ? audioPath.slice(1) : audioPath;

    const { data: existing } = await supabase.storage
      .from(BUCKET)
      .list(path.dirname(storagePath), { search: path.basename(storagePath) });

    if (existing && existing.length > 0) {
      console.log(`[${item.variant_id}] Already exists — skipping.`);
      skipped++;
      continue;
    }

    const transcript = item.transcript as string;
    const meta = (item.metadata as Record<string, string>) ?? {};
    const voiceKey = meta.voice ?? 'adult_female';
    const voiceName = VOICE_MAP[voiceKey] ?? 'Aoede';

    console.log(`[${item.variant_id}] Generating TTS with voice ${voiceName}…`);

    try {
      const result = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ role: 'user', parts: [{ text: transcript }] }],
        config: {
          responseModalities: ['audio'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      });

      const audioPart = result.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData
      );

      if (!audioPart?.inlineData?.data) {
        console.error(`[${item.variant_id}] No audio data returned.`);
        failed++;
        continue;
      }

      const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, audioBuffer, {
          contentType: audioPart.inlineData.mimeType ?? 'audio/L16;codec=pcm;rate=24000',
          upsert: false,
        });

      if (uploadError) {
        console.error(`[${item.variant_id}] Upload failed:`, uploadError.message);
        failed++;
        continue;
      }

      console.log(`[${item.variant_id}] Uploaded to ${storagePath}`);
      generated++;

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[${item.variant_id}] Error:`, err);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated} | Skipped: ${skipped} | Failed: ${failed}`);

  if (failed > 0) {
    console.log('Re-run the script to retry failed items (it is idempotent).');
    process.exit(1);
  }
}

main();
