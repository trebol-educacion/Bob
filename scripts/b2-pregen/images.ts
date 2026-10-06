import type { GoogleGenAI } from '@google/genai';
import type { Db } from './env';
import { toJpeg } from './ffmpeg';
import { MODELS } from '../../src/lib/models';
import { imagePath } from './variant';

const BUCKET = 'bob-images';
const MAX_ATTEMPTS = 4;

export interface SceneImages {
  image_url_a: string;
  image_url_b: string;
}

async function loadImagePrompt(db: Db): Promise<string> {
  const key = 'cambridge_fce_p2_b2_image_gen';
  const { data, error } = await db.from('prompts').select('prompt_current').eq('prompt_key', key).single();
  if (error || !data?.prompt_current) throw new Error(`Prompt ${key} not found: ${error?.message ?? 'empty'}`);
  return data.prompt_current as string;
}

async function render(ai: GoogleGenAI, prompt: string): Promise<Buffer> {
  let lastError = 'no image returned';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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

async function publish(db: Db, ai: GoogleGenAI, template: string, topic: string, scene: string, path: string): Promise<string> {
  const prompt = template.replaceAll('{TOPIC}', topic).replaceAll('{SCENE_PROMPT}', scene);
  const jpeg = await toJpeg(await render(ai, prompt));
  const { error } = await db.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Upload ${path} failed: ${error.message}`);
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * @param ai
 * @param db
 * @param variant group variant id
 * @param metadata Part 2 group metadata with the two scene prompts
 * @returns public URLs of the two generated photographs
 */
export async function produceSceneImages(
  ai: GoogleGenAI,
  db: Db,
  variant: string,
  metadata: Record<string, unknown>,
): Promise<SceneImages> {
  const template = await loadImagePrompt(db);
  const topic = String(metadata.topic ?? '');
  const [a, b] = await Promise.all([
    publish(db, ai, template, topic, String(metadata.scene_prompt_a), imagePath(variant, 'a')),
    publish(db, ai, template, topic, String(metadata.scene_prompt_b), imagePath(variant, 'b')),
  ]);
  return { image_url_a: a, image_url_b: b };
}
