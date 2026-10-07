import type { GoogleGenAI } from '@google/genai';
import type { Db } from '../b2-pregen/env';
import { toJpeg, wavToMp3 } from '../b2-pregen/ffmpeg';
import { synthesize, type Speaker } from '../b2-pregen/tts';
import { MODELS } from '../../src/lib/models';

const AUDIO_BUCKET = 'bob-listening';
const IMAGE_BUCKET = 'bob-images';
const IMAGE_ATTEMPTS = 4;

export const FEMALE_VOICES = ['Aoede', 'Kore'];
export const MALE_VOICES = ['Orus', 'Charon'];
export const SOLO_VOICES = ['Aoede', 'Orus', 'Kore', 'Charon', 'Zephyr'];

/**
 * @param examPart
 * @param variant
 * @param name
 * @returns bucket-relative path with leading slash
 */
export function assetPath(examPart: string, variant: string, name: string): string {
  return `/${examPart.replace(/_/g, '-')}/${variant}-${name}`;
}

function publicUrl(db: Db, bucket: string, path: string): string {
  return db.storage.from(bucket).getPublicUrl(path.replace(/^\//, '')).data.publicUrl;
}

/**
 * @param db
 * @param path bucket-relative path ending in .mp3
 * @param wav WAV audio
 * @returns public URL of the uploaded MP3
 */
export async function uploadAudio(db: Db, path: string, wav: Buffer): Promise<string> {
  const mp3 = await wavToMp3(wav);
  const key = path.replace(/^\//, '');
  const { error } = await db.storage.from(AUDIO_BUCKET).upload(key, mp3, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Upload ${path} failed: ${error.message}`);
  return publicUrl(db, AUDIO_BUCKET, path);
}

/**
 * @param ai
 * @param db
 * @param path bucket-relative path ending in .mp3
 * @param text text, or "<Speaker>: line" lines when two voices are given
 * @param speakers one voice, or two named speakers
 * @returns public URL of the MP3
 */
export async function speak(ai: GoogleGenAI, db: Db, path: string, text: string, speakers: Speaker[]): Promise<string> {
  return uploadAudio(db, path, await synthesize(ai, text, speakers));
}

/**
 * @param slot
 * @returns Man and Woman voices rotating with the slot
 */
export function dialogueVoices(slot: number): Speaker[] {
  return [
    { name: 'Woman', voice: FEMALE_VOICES[slot % 2] },
    { name: 'Man', voice: MALE_VOICES[slot % 2] },
  ];
}

/**
 * @param slot
 * @returns one narrator voice rotating with the slot
 */
export function soloVoice(slot: number): Speaker[] {
  return [{ name: 'Speaker', voice: SOLO_VOICES[slot % SOLO_VOICES.length] }];
}

async function render(ai: GoogleGenAI, prompt: string): Promise<Buffer> {
  let lastError = 'no image returned';
  for (let attempt = 1; attempt <= IMAGE_ATTEMPTS; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: MODELS.IMAGE,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseModalities: ['IMAGE'] },
      });
      const part = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part?.inlineData?.data) return Buffer.from(part.inlineData.data, 'base64');
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`Image generation failed: ${lastError}`);
}

/**
 * @param ai
 * @param db
 * @param path bucket-relative path ending in .jpg
 * @param prompt full image prompt
 * @returns public URL of the 1024 px JPEG
 */
export async function drawImage(ai: GoogleGenAI, db: Db, path: string, prompt: string): Promise<string> {
  const jpeg = await toJpeg(await render(ai, prompt));
  const key = path.replace(/^\//, '');
  const { error } = await db.storage.from(IMAGE_BUCKET).upload(key, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Upload ${path} failed: ${error.message}`);
  return publicUrl(db, IMAGE_BUCKET, path);
}

/**
 * @param db
 * @param key prompt_key in bob.prompts
 * @returns current prompt text
 */
export async function loadPromptText(db: Db, key: string): Promise<string> {
  const { data, error } = await db.from('prompts').select('prompt_current').eq('prompt_key', key).single();
  if (error || !data?.prompt_current) throw new Error(`Prompt ${key} not found: ${error?.message ?? 'empty'}`);
  return data.prompt_current as string;
}

/**
 * @param tasks async jobs
 * @param limit parallel jobs
 * @returns results in task order
 */
export async function inBatches<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    results.push(...(await Promise.all(tasks.slice(i, i + limit).map((task) => task()))));
  }
  return results;
}
