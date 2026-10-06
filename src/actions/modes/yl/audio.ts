'use server';

import { generateSpeechAction } from '@/actions/gemini';

export async function getOrCreateCueAudioAction(
  cueText: string
): Promise<{ data: string; mimeType: string }> {
  return generateSpeechAction(cueText);
}

export async function pregenerateYLCueAudiosAction(cues: string[]): Promise<void> {
  await Promise.all(
    cues.map(async (cue) => {
      try {
        await generateSpeechAction(cue);
      } catch (err) {
        console.warn('[YL] pregenerate cue audio failed (non-fatal):', err);
      }
    }),
  );
}
