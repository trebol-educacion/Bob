import type { GoogleGenAI } from '@google/genai';
import type { Db } from './env';
import { relabel, synthesize } from './tts';
import { audioPath } from './variant';
import type { Payload } from './schemas';

const BUCKET = 'bob-listening';
const FEMALE = ['Aoede', 'Kore'];
const MALE = ['Orus', 'Charon'];
const CLIP_VOICES = ['Aoede', 'Orus', 'Kore', 'Charon', 'Zephyr'];

export interface AudioPlan {
  groupAudio: string | null;
  itemAudio: (string | null)[];
}

async function upload(db: Db, path: string, wav: Buffer): Promise<string> {
  const { error } = await db.storage.from(BUCKET).upload(path.slice(1), wav, { contentType: 'audio/wav', upsert: true });
  if (error) throw new Error(`Upload ${path} failed: ${error.message}`);
  return path;
}

async function clip(ai: GoogleGenAI, db: Db, path: string, transcript: string, slot: number): Promise<string> {
  const dialogue = /^Speaker 1:/m.test(transcript) && /^Speaker 2:/m.test(transcript);
  const wav = dialogue
    ? await synthesize(ai, transcript, [
        { name: 'Speaker 1', voice: FEMALE[slot % 2] },
        { name: 'Speaker 2', voice: MALE[slot % 2] },
      ])
    : await synthesize(ai, transcript, [{ name: 'Speaker', voice: CLIP_VOICES[slot % 4] }]);
  return upload(db, path, wav);
}

/**
 * @param ai
 * @param db
 * @param examPart
 * @param variant
 * @param slot
 * @param payload
 * @returns bucket-relative audio paths for the group and each item; null where the part has no audio
 */
export async function produceAudio(
  ai: GoogleGenAI,
  db: Db,
  examPart: string,
  variant: string,
  slot: number,
  payload: Payload,
): Promise<AudioPlan> {
  const none: AudioPlan = { groupAudio: null, itemAudio: payload.items.map(() => null) };
  if (examPart === 'fce_listening_part1') {
    const itemAudio: string[] = [];
    for (const [index, item] of payload.items.entries()) {
      itemAudio.push(await clip(ai, db, audioPath(examPart, variant, `q${index + 1}`), item.transcript ?? '', slot + index));
    }
    return { groupAudio: null, itemAudio };
  }
  if (examPart === 'fce_listening_part2') {
    const transcript = String(payload.group?.metadata.transcript ?? '');
    const path = audioPath(examPart, variant);
    return { ...none, groupAudio: await upload(db, path, await synthesize(ai, transcript, [{ name: 'Speaker', voice: slot % 2 ? 'Orus' : 'Aoede' }])) };
  }
  if (examPart === 'fce_listening_part3') {
    const itemAudio: string[] = [];
    for (const [index, item] of payload.items.entries()) {
      const wav = await synthesize(ai, item.transcript ?? '', [{ name: 'Speaker', voice: CLIP_VOICES[index % CLIP_VOICES.length] }]);
      itemAudio.push(await upload(db, audioPath(examPart, variant, `s${index + 1}`), wav));
    }
    return { groupAudio: null, itemAudio };
  }
  if (examPart === 'fce_listening_part4') {
    const transcript = relabel(String(payload.group?.metadata.transcript ?? ''), { I: 'Interviewer', E: 'Expert' });
    const wav = await synthesize(ai, transcript, [
      { name: 'Interviewer', voice: 'Kore' },
      { name: 'Expert', voice: 'Orus' },
    ]);
    return { ...none, groupAudio: await upload(db, audioPath(examPart, variant), wav) };
  }
  return none;
}
