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
 * @param sessionId string
 * @param topic string
 */
export async function generatePracticeImageAction(sessionId: string, topic: string): Promise<PracticeImageResult> {
  try {
    const scenePrompt = await getPrompt('practice_picture_shared_image_prompt', { TOPIC: topic });
    const dataUri = await generateImageAction(scenePrompt);
    if (!dataUri) return { ok: false, imageUrl: null };

    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, imageUrl: null };

    const match = /^data:(.+);base64,(.+)$/.exec(dataUri);
    if (!match) return { ok: false, imageUrl: null };
    const [, mimeType, base64] = match;
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const path = `${user.id}/${sessionId}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(base64, 'base64');

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) return { ok: false, imageUrl: null };

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) return { ok: false, imageUrl: null };

    await savePracticeImageAction({
      sessionId,
      prompt: scenePrompt,
      imageUrl: signed.signedUrl,
      model: MODELS.IMAGE,
    });

    return { ok: true, imageUrl: signed.signedUrl };
  } catch (e) {
    console.error(JSON.stringify({ event: 'generatePracticeImageAction_failed', error: String(e) }));
    return { ok: false, imageUrl: null };
  }
}
