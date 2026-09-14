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

const BOB_VOICE = 'Sadaltager';

const FORCE_REGEN = process.argv.includes('--force');

function extractSampleRate(mimeType?: string): number | null {
  if (!mimeType) return null;
  const m = mimeType.match(/rate=(\d+)/);
  return m ? Number(m[1]) : null;
}

function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitDepth: number): Buffer {
  const dataSize = pcm.length;
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    db: { schema: 'bob' },
  });
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const { data: items, error } = await supabase
    .from('closed_items')
    .select('id, variant_id, cefr_level, stimulus_audio_url, transcript, metadata')
    .eq('skill', 'listening')
    .eq('status', 'enabled')
    .not('transcript', 'is', null)
    .in('exam_part', ['assessment_listening', 'pet_listening_part2', 'fce_listening_part1']);

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

    if (!FORCE_REGEN) {
      const { data: existing } = await supabase.storage
        .from(BUCKET)
        .list(path.dirname(storagePath), { search: path.basename(storagePath) });

      if (existing && existing.length > 0) {
        const head = await fetch(
          `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`,
          { method: 'HEAD' },
        );
        const ct = head.headers.get('content-type') ?? '';
        if (ct.includes('wav') || ct.includes('mpeg')) {
          console.log(`[${item.variant_id}] Already exists with valid audio — skipping.`);
          skipped++;
          continue;
        }
        console.log(`[${item.variant_id}] Exists but content-type is ${ct} — regenerating with WAV wrapper.`);
      }
    }

    const transcript = item.transcript as string;
    const voiceName = BOB_VOICE;

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

      const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
      const sampleRate = extractSampleRate(audioPart.inlineData.mimeType) ?? 24000;
      const wavBuffer = pcmToWav(pcmBuffer, sampleRate, 1, 16);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, wavBuffer, {
          contentType: 'audio/wav',
          upsert: true,
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
