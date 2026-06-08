'use server';

import { type EvalResponse } from '@/lib/types/practice';
import { createSupabaseServer } from '@/lib/supabase/server';
import { persistMessage, persistMessages } from '@/lib/persist-activity';

export async function persistYLImageAction(
  sessionId: string,
  imageDataUri: string,
  imageIndex: number
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'persistYLImageAction', error: 'Not authenticated' }));
    return;
  }

  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'image_scene',
    contentText: null,
    contentJson: { image_data_uri: imageDataUri, image_index: imageIndex },
  });
}

/** @deprecated Kept for backwards compatibility — iterates one image at a time. */
export async function persistYLImagesAction(
  sessionId: string,
  imageDataUris: string[]
): Promise<void> {
  for (let i = 0; i < imageDataUris.length; i++) {
    await persistYLImageAction(sessionId, imageDataUris[i], i);
  }
}

export async function saveYLFinalEvalAction(
  sessionId: string,
  evalResult: EvalResponse
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'saveYLFinalEvalAction', error: 'Not authenticated' }));
    return;
  }
  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: { ...evalResult, is_final: true },
  });
}

export async function saveYLTurnAction(
  sessionId: string,
  turn: {
    cue: string;
    cueIndex: number;
    transcript: string;
    reaction: string;
    score?: number;
    evalResult?: EvalResponse;
  }
): Promise<void> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'saveYLTurnAction', error: 'Not authenticated' }));
    return;
  }

  const result = await persistMessages([
    {
      sessionId,
      userId: user.id,
      role: 'user',
      msgType: 'user_audio',
      contentText: turn.transcript,
      contentJson: {
        cue: turn.cue,
        cue_index: turn.cueIndex,
        transcribed: turn.transcript,
      },
    },
    {
      sessionId,
      userId: user.id,
      role: 'bob',
      msgType: 'yl_cue',
      contentText: turn.reaction,
      contentJson: {
        reaction: turn.reaction,
        cue_index: turn.cueIndex,
        ...(turn.evalResult ? { eval: turn.evalResult } : {}),
      },
    },
  ]);

  if ('error' in result) {
    console.error(JSON.stringify({ event: 'saveYLTurnAction', error: result.error }));
  }
}
