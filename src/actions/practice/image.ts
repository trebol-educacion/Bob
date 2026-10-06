'use server';

import { randomUUID } from 'node:crypto';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { generateImageAction } from '@/actions/gemini/image';
import { createSupabaseServer } from '@/lib/supabase/server';

const BUCKET = 'bob-practice-images';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 90;

export interface PracticeImageResult {
  ok: boolean;
  imageUrl: string | null;
  prompt: string | null;
}

const FAILED: PracticeImageResult = { ok: false, imageUrl: null, prompt: null };

/**
 * @param topic - scene of the picture
 * @returns signed url of the stored picture, or the inline data uri when storage fails
 */
export async function generatePracticeImageAction(topic: string): Promise<PracticeImageResult> {
  try {
    const scenePrompt = await getPrompt('practice_picture_shared_image_prompt', { TOPIC: topic });
    const dataUri = await generateImageAction(scenePrompt);
    if (!dataUri) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', reason: 'empty_image_from_model', topic }));
      return FAILED;
    }

    const match = /^data:(.+);base64,(.+)$/.exec(dataUri);
    if (!match) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', reason: 'malformed_data_uri' }));
      return FAILED;
    }

    const storedUrl = await storePracticeImage(match);
    return { ok: true, imageUrl: storedUrl ?? dataUri, prompt: scenePrompt };
  } catch (e) {
    console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', reason: 'unexpected_error', error: String(e), topic }));
    return FAILED;
  }
}

/** @param match - data uri parts: mime type and base64 payload */
async function storePracticeImage(match: RegExpExecArray): Promise<string | null> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [, mimeType, base64] = match;
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const path = `${user.id}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(base64, 'base64'), { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_upload_failed', reason: uploadError.message }));
      return null;
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed?.signedUrl) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_sign_failed', reason: signError?.message ?? 'no_signed_url' }));
      return null;
    }
    return signed.signedUrl;
  } catch (e) {
    console.error(JSON.stringify({ event: 'generatePracticeImageAction_persist_failed', reason: String(e) }));
    return null;
  }
}
