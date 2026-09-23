'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { generateImageAction } from '@/actions/gemini/image';
import { createSupabaseServer } from '@/lib/supabase/server';
import { savePracticeImageAction } from './repository';
import { MODELS } from '@/lib/models';

const BUCKET = 'bob-practice-images';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface PracticeImageResult {
  ok: boolean;
  imageUrl: string | null;
}

/**
 * @param sessionId string | null
 * @param topic string
 */
export async function generatePracticeImageAction(sessionId: string | null, topic: string): Promise<PracticeImageResult> {
  try {
    const scenePrompt = await getPrompt('practice_picture_shared_image_prompt', { TOPIC: topic });
    const dataUri = await generateImageAction(scenePrompt);
    if (!dataUri) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', reason: 'empty_image_from_model', sessionId, topic }));
      return { ok: false, imageUrl: null };
    }

    const match = /^data:(.+);base64,(.+)$/.exec(dataUri);
    if (!match) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', reason: 'malformed_data_uri', sessionId }));
      return { ok: false, imageUrl: null };
    }

    const persistedUrl = await persistPracticeImage({ sessionId, match, scenePrompt });
    return { ok: true, imageUrl: persistedUrl ?? dataUri };
  } catch (e) {
    console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', reason: 'unexpected_error', error: String(e), sessionId, topic }));
    return { ok: false, imageUrl: null };
  }
}

/**
 * @param input sessionId, match, scenePrompt
 * @returns string | null
 */
async function persistPracticeImage(input: {
  sessionId: string | null;
  match: RegExpExecArray;
  scenePrompt: string;
}): Promise<string | null> {
  const { sessionId, match, scenePrompt } = input;
  if (!sessionId) {
    console.error(JSON.stringify({ event: 'generatePracticeImageAction_persist_skipped', reason: 'no_session_id_degraded_repository' }));
    return null;
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_persist_skipped', reason: 'no_authenticated_user', sessionId }));
      return null;
    }

    const [, mimeType, base64] = match;
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const path = `${user.id}/${sessionId}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(base64, 'base64');

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_upload_failed', reason: uploadError.message, sessionId }));
      return null;
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_sign_failed', reason: signError?.message ?? 'no_signed_url', sessionId }));
      return null;
    }

    const saved = await savePracticeImageAction({
      sessionId,
      prompt: scenePrompt,
      imageUrl: signed.signedUrl,
      model: MODELS.IMAGE,
    });
    if (!saved.ok) {
      console.error(JSON.stringify({ event: 'generatePracticeImageAction_save_failed', reason: saved.code, sessionId }));
    }

    return signed.signedUrl;
  } catch (e) {
    console.error(JSON.stringify({ event: 'generatePracticeImageAction_persist_failed', reason: String(e), sessionId }));
    return null;
  }
}
