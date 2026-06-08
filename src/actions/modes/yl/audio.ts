'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { persistMessage } from '@/lib/persist-activity';
import { generateSpeechAction } from '@/actions/gemini';

export async function getOrCreateCueAudioAction(
  sessionId: string,
  cueText: string
): Promise<{ data: string; mimeType: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'getOrCreateCueAudioAction', error: 'Not authenticated' }));
    return { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };
  }

  const { data: existing } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('session_id', sessionId)
    .eq('msg_type', 'yl_tts')
    .eq('content_text', cueText)
    .limit(1)
    .maybeSingle();

  if (existing?.content_json) {
    const cached = existing.content_json as { audio_b64?: string; mime?: string };
    if (cached.audio_b64) {
      return { data: cached.audio_b64, mimeType: cached.mime ?? 'audio/L16;codec=pcm;rate=24000' };
    }
  }

  const { data, mimeType } = await generateSpeechAction(cueText);

  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'yl_tts',
    contentText: cueText,
    contentJson: { audio_b64: data, mime: mimeType },
  });

  return { data, mimeType };
}

export async function pregenerateYLCueAudiosAction(
  sessionId: string,
  cues: string[],
): Promise<void> {
  await Promise.all(
    cues.map(async (cue) => {
      try {
        await getOrCreateCueAudioAction(sessionId, cue);
      } catch (err) {
        console.warn('[YL] pregenerate cue audio failed (non-fatal):', err);
      }
    }),
  );
}
