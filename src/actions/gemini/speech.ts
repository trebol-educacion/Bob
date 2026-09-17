'use server';

import { Part } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini } from '@/lib/gemini-client';

/** Generates high-quality speech for a given text using Gemini's native audio output. */
export async function generateSpeechAction(text: string): Promise<{ data: string; mimeType: string }> {
  const fallback = { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };

  const cached = await getOrCreateCachedContent<{ data: string; mimeType: string }>(
    { kind: 'tts', promptKey: 'gemini-speech', inputs: { text, voice: 'Sadaltager' } },
    async () => {
      const result = await callGemini(
        { promptKey: 'gemini-speech', model: MODELS.TTS },
        (ai) => ai.models.generateContent({
          model: MODELS.TTS,
          contents: [{ role: 'user', parts: [{ text: `Read this phrase aloud with clear pronunciation: "${text}"` }] }],
          config: {
            responseModalities: ['audio'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Sadaltager' },
              },
            },
          },
        })
      );

      if (!result.ok) {
        console.error(JSON.stringify({ event: 'generateSpeechAction', error: result.error }));
        return fallback;
      }

      const audioPart = result.data.candidates?.[0]?.content?.parts?.find((p: Part) => p.inlineData);

      if (!audioPart?.inlineData?.data) {
        console.error(JSON.stringify({ event: 'generateSpeechAction', error: 'No audio data in response' }));
        return fallback;
      }

      return {
        data: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000',
      };
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateSpeechAction_cache', error: cached.error }));
    return fallback;
  }
  return cached;
}

