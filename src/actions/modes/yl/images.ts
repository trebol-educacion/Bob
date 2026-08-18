'use server';

import { MODELS } from '@/lib/models';
import { type YLExam } from '@/lib/types/yl';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini } from '@/lib/gemini-client';
import {
  buildDirectImagenPrompt,
  generateImageWithFallback,
  YL_IMAGE_PLACEHOLDER,
} from '@/lib/yl-imagen';
import { imageGenKey } from './_helpers';
import { type YLImageType } from './types';
import { persistYLImageAction } from './persist';

const POOL_REUSE_PROBABILITY = 0.7;

async function tryPickFromImagePool(opts: {
  framework: string;
  cefr_level: string;
  word: string;
  image_type: YLImageType;
}): Promise<string | null> {
  if (Math.random() >= POOL_REUSE_PROBABILITY) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('word_images')
    .select('id, image_url')
    .eq('framework', opts.framework)
    .eq('cefr_level', opts.cefr_level)
    .eq('word', opts.word)
    .eq('image_type', opts.image_type)
    .limit(50);
  const rows = (data ?? []) as Array<{ id: number; image_url: string }>;
  if (rows.length === 0) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)];
  void supabase
    .from('word_images')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', pick.id)
    .then(() => undefined, () => undefined);
  return pick.image_url;
}

async function addImageToPool(opts: {
  framework: string;
  cefr_level: string;
  word: string;
  image_url: string;
  scene_prompt: string;
  image_type: YLImageType;
}): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase
    .from('word_images')
    .insert({
      framework: opts.framework,
      cefr_level: opts.cefr_level,
      word: opts.word,
      image_url: opts.image_url,
      scene_prompt: opts.scene_prompt,
      image_type: opts.image_type,
    })
    .then(() => undefined, (err) => console.warn('[addImageToPool] insert failed', err));
}

/**
 * Generate a single YL image. Called one-at-a-time from the client to
 * avoid Next.js server-action "Maximum array nesting" when several large
 * base64 strings travel together. Iterate at the call site, not here.
 */
export async function generateYLImageAction(
  exam: YLExam,
  part: number,
  imagePrompt: string,
  idx: number,
  totalImages: number,
  sessionId: string,
  characterDescription?: string
): Promise<string> {
  const cacheInputs: Record<string, unknown> = { exam, part, imagePrompt };
  if (characterDescription) cacheInputs.characterDescription = characterDescription;

  const cached = await getOrCreateCachedContent<string>(
    { kind: 'image', promptKey: `yl-image-${exam}-part${part}`, inputs: cacheInputs },
    async () => {
      const key = imageGenKey(exam, part);
      const imagenPrompt = buildDirectImagenPrompt(imagePrompt, characterDescription);
      const pixels = await generateImageWithFallback(key, imagenPrompt);

      if (!pixels) {
        throw new Error('empty image after all attempts');
      }

      const { b64: imgB64, mime } = pixels;

      const supabase = await createSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error(JSON.stringify({ event: 'generateYLImageAction', error: 'Not authenticated for storage upload' }));
        return `data:${mime};base64,${imgB64}`;
      }

      const ext = mime.includes('jpeg') ? 'jpg' : 'png';
      const path = `${user.id}/${sessionId}/${idx}.${ext}`;
      const bytes = Buffer.from(imgB64, 'base64');
      const upload = await supabase.storage
        .from('bob-images')
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (upload.error) {
        console.error('[generateYLImageAction] storage upload failed:', upload.error);
        return `data:${mime};base64,${imgB64}`;
      }

      const { data: pub } = supabase.storage.from('bob-images').getPublicUrl(path);
      return pub.publicUrl;
    },
    { storeAs: 'blob', validate: (url) => typeof url === 'string' && url.startsWith('https://') }
  );

  if (typeof cached === 'object' && 'error' in cached) {
    return YL_IMAGE_PLACEHOLDER;
  }
  return cached as string;
}

/**
 * Parallel batch variant. One Server Action call → `Promise.all` of N
 * generations + Supabase Storage uploads on the server. Returns URLs only,
 * so payload stays tiny. Bypasses Next.js Server Action client queue, which
 * would otherwise serialise N separate `generateYLImageAction` calls.
 *
 * Accepts both shapes for backwards compatibility:
 *   - `string[]` (legacy)  → no word-image pool reuse, always generates.
 *   - `Array<{word, scenePrompt}>` → checks bob_word_images pool first
 *     (70% probability of reuse if pool has entries for that word).
 */
export async function generateYLImagesParallelAction(
  exam: YLExam,
  part: number,
  imagePrompts: string[] | Array<{ word: string; scenePrompt: string }>,
  sessionId: string,
  characterDescription?: string,
  imageType: YLImageType = 'scene'
): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const items: Array<{ word?: string; scenePrompt: string }> = imagePrompts.map((p) =>
    typeof p === 'string' ? { scenePrompt: p } : p
  );

  return Promise.all(
    items.map(async (item, idx) => {
      if (item.word) {
        const fromPool = await tryPickFromImagePool({
          framework: 'cambridge',
          cefr_level: 'pre_a1',
          word: item.word,
          image_type: imageType,
        });
        if (fromPool) return fromPool;
      }

      const effectiveCharacter = imageType === 'object_card' ? undefined : characterDescription;
      const cacheInputs: Record<string, unknown> = { exam, part, imagePrompt: item.scenePrompt, imageType };
      if (effectiveCharacter) cacheInputs.characterDescription = effectiveCharacter;

      const cached = await getOrCreateCachedContent<string>(
        { kind: 'image', promptKey: `yl-image-${exam}-part${part}`, inputs: cacheInputs },
        async () => {
          const key = imageGenKey(exam, part);
          const imagenPrompt = buildDirectImagenPrompt(item.scenePrompt, effectiveCharacter, imageType);
          const pixels = await generateImageWithFallback(key, imagenPrompt);
          if (!pixels) throw new Error('empty image after all attempts');

          const { b64: imgB64, mime } = pixels;
          if (!user) return `data:${mime};base64,${imgB64}`;

          const ext = mime.includes('jpeg') ? 'jpg' : 'png';
          const path = `${user.id}/${sessionId}/${idx}.${ext}`;
          const bytes = Buffer.from(imgB64, 'base64');
          const upload = await supabase.storage
            .from('bob-images')
            .upload(path, bytes, { contentType: mime, upsert: true });
          if (upload.error) {
            console.error('[generateYLImagesParallelAction] storage upload failed:', upload.error);
            return `data:${mime};base64,${imgB64}`;
          }
          const { data: pub } = supabase.storage.from('bob-images').getPublicUrl(path);
          return pub.publicUrl;
        },
        { storeAs: 'blob', validate: (url) => typeof url === 'string' && url.startsWith('https://') }
      );

      if (typeof cached === 'object' && 'error' in cached) return YL_IMAGE_PLACEHOLDER;

      const url = cached as string;
      if (item.word && url.startsWith('https://')) {
        void addImageToPool({
          framework: 'cambridge',
          cefr_level: 'pre_a1',
          word: item.word,
          image_url: url,
          scene_prompt: item.scenePrompt,
          image_type: imageType,
        });
      }
      return url;
    })
  );
}

/**
 * @deprecated Batched variant — kept temporarily for callers that still
 * pass an array. Prefer calling generateYLImageAction directly from the
 * client in a loop.
 */
export async function generateYLImagesAction(
  exam: YLExam,
  part: number,
  imagePrompts: string[],
  characterDescription?: string,
  sessionId?: string,
): Promise<string[]> {
  const key = imageGenKey(exam, part);

  console.log(`[YL][${exam}_part${part}] generating ${imagePrompts.length} image(s)`);
  const t0 = Date.now();

  const images = await Promise.all(
    imagePrompts.map(async (imagePrompt, idx) => {
      const imagenPrompt = buildDirectImagenPrompt(imagePrompt, characterDescription);
      const pixels = await generateImageWithFallback(key, imagenPrompt);
      if (pixels) {
        console.log(
          `[YL][${exam}_part${part}] image ${idx + 1} ok in ${Date.now() - t0}ms (total elapsed)`
        );
        return `data:${pixels.mime};base64,${pixels.b64}`;
      }
      console.warn(`[generateYLImagesAction] empty image ${idx + 1}; scene:`, imagePrompt.slice(0, 120));
      return YL_IMAGE_PLACEHOLDER;
    })
  );

  if (sessionId) {
    for (let i = 0; i < images.length; i++) {
      try {
        await persistYLImageAction(sessionId, images[i], i);
      } catch (err) {
        console.warn(`[YL][${exam}_part${part}] persist image ${i} failed (non-fatal):`, err);
      }
    }
  }

  return images;
}
