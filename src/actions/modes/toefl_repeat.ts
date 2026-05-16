'use server';

import { z } from 'zod';
import { Type, Part } from '@google/genai';
import { MODELS } from '@/lib/models';
import { RepetitionObjectiveFeedbackSchema, type RepetitionObjectiveFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';

const ToeflRepeatItemSchema = z.object({
  text: z.string(),
  difficulty: z.number().min(1).max(5),
});

const ToeflRepeatSessionSchema = z.object({
  items: z.array(ToeflRepeatItemSchema).length(10),
});

export type ToeflRepeatItem = z.infer<typeof ToeflRepeatItemSchema>;

export type ToeflAudioChunk = {
  data: string;
  mimeType: string;
};

const SessionFallback: ToeflRepeatItem[] = Array.from({ length: 10 }, (_, i) => ({
  text: `Please repeat this sentence clearly and naturally. Number ${i + 1}.`,
  difficulty: Math.min(5, Math.floor(i / 2) + 1),
}));

const ObjectiveFeedbackFallback: RepetitionObjectiveFeedback = {
  kind: 'repetition_objective',
  exact_repetition: false,
  missing_words: [],
  extra_words: [],
  transcribed_text: '',
  original_text: '',
};

/**
 * Generates 10 progressive TOEFL Listen & Repeat items and persists the phrase plan.
 */
export async function generateToeflRepeatSessionAction(
  sessionId: string,
  userId: string
): Promise<ToeflRepeatItem[]> {
  const cached = await getOrCreateCachedContent<ToeflRepeatItem[]>(
    { kind: 'plan', promptKey: 'toefl-listen-repeat-b1-plan', inputs: {} },
    async () => {
      const prompt = await getPrompt('toefl_listen_repeat_b1_generation');

      const result = await callGemini(
        { promptKey: 'toefl_listen_repeat_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      difficulty: { type: Type.NUMBER },
                    },
                    required: ['text', 'difficulty'],
                  },
                },
              },
              required: ['items'],
            },
          },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generateToeflRepeatSessionAction', error: result.ok ? 'empty response' : result.error }));
        return SessionFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        return SessionFallback;
      }
      const validated = safeParseFallback(ToeflRepeatSessionSchema, parsed, { items: SessionFallback });
      return validated.items;
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateToeflRepeatSessionAction_cache', error: cached.error }));
    return SessionFallback;
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: { phrases: cached },
  });
  if ('error' in persistResult) {
    console.error('[ToeflRepeat persist] phrase plan failed:', persistResult.error);
  }

  return cached;
}

/**
 * Pre-generates TTS audio for all phrases in parallel (max concurrency 3).
 * Returns raw PCM base64 + mimeType for each phrase — client converts to WAV.
 */
export async function generateToeflRepeatAudiosAction(
  phrases: string[]
): Promise<ToeflAudioChunk[]> {
  const audioFallback: ToeflAudioChunk = { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };
  const CONCURRENCY = 3;
  const results: ToeflAudioChunk[] = [];

  const generateOne = async (phrase: string): Promise<ToeflAudioChunk> => {
    const cached = await getOrCreateCachedContent<ToeflAudioChunk>(
      { kind: 'tts', promptKey: 'toefl-listen-repeat-phrase-tts', inputs: { text: phrase, voice: 'Sadaltager' } },
      async () => {
        const result = await callGemini(
          { promptKey: 'toefl-listen-repeat-phrase-tts', model: MODELS.TTS },
          (ai) => ai.models.generateContent({
            model: MODELS.TTS,
            contents: [
              {
                role: 'user',
                parts: [{ text: `Read this sentence aloud with clear, natural pronunciation: "${phrase}"` }],
              },
            ],
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
          console.error(JSON.stringify({ event: 'generateToeflRepeatAudiosAction', phrase: phrase.slice(0, 40), error: result.error }));
          return audioFallback;
        }

        const audioPart = result.data.candidates?.[0]?.content?.parts?.find((p: Part) => p.inlineData);

        if (!audioPart?.inlineData?.data) {
          console.error(JSON.stringify({ event: 'generateToeflRepeatAudiosAction', phrase: phrase.slice(0, 40), error: 'no audio data' }));
          return audioFallback;
        }

        return {
          data: audioPart.inlineData.data,
          mimeType: audioPart.inlineData.mimeType ?? 'audio/L16;codec=pcm;rate=24000',
        };
      },
      { storeAs: 'json' }
    );

    if ('error' in cached) {
      console.error(JSON.stringify({ event: 'generateToeflRepeatAudiosAction_cache', error: cached.error }));
      return audioFallback;
    }
    return cached;
  };

  for (let i = 0; i < phrases.length; i += CONCURRENCY) {
    const batch = phrases.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(generateOne));
    results.push(...batchResults);
  }

  return results;
}

/** Evaluates a repetition attempt; returns objective word-level metrics (no subjective score). */
export async function evaluateRepetitionAction(
  originalText: string,
  audioBase64: string,
  mimeType: string,
  sessionId: string,
  userId: string,
  phraseIndex: number
): Promise<RepetitionObjectiveFeedback> {
  const prompt = `You are evaluating a Listen & Repeat exercise.

Target sentence: "${originalText}"

Listen to the audio and transcribe what the student said. Then compare word by word.

Return ONLY a JSON object with these fields:
- "kind": always "repetition_objective"
- "exact_repetition": boolean — true only if every word matches exactly (case-insensitive)
- "missing_words": array of words from the target sentence that were omitted
- "extra_words": array of words the student said that are not in the target sentence
- "transcribed_text": what the student actually said (verbatim transcription)
- "original_text": "${originalText}"

Return ONLY valid JSON. No score, no pronunciation rating, no subjective assessment.`;

  const result = await callGemini(
    { promptKey: 'toefl_listen_repeat_b1_objective', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: 'application/json' },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateRepetitionAction', error: result.ok ? 'empty response' : result.error }));
    return { ...ObjectiveFeedbackFallback, original_text: originalText };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return { ...ObjectiveFeedbackFallback, original_text: originalText };
  }

  const feedback = safeParseFallback(RepetitionObjectiveFeedbackSchema, parsed, { ...ObjectiveFeedbackFallback, original_text: originalText });

  const audioResult = await persistMessage({
    sessionId,
    userId,
    role: 'user',
    msgType: 'user_audio',
    contentText: feedback.transcribed_text || null,
    contentJson: { phraseIndex, exact_repetition: feedback.exact_repetition },
  });
  if ('error' in audioResult) {
    console.error('[ToeflRepeat persist] user_audio failed:', audioResult.error);
  }

  const evalResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { phraseIndex, ...feedback },
  });
  if ('error' in evalResult) {
    console.error('[ToeflRepeat persist] evaluation failed:', evalResult.error);
  }

  return feedback;
}

/**
 * Persists the session-level summary after all items are completed.
 */
export async function saveToeflRepeatSummaryAction(
  sessionId: string,
  userId: string,
  summary: { exactCount: number; totalCount: number; itemCount: number }
): Promise<void> {
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: `Session complete. Exact repetitions: ${summary.exactCount} of ${summary.totalCount}`,
    contentJson: summary,
  });
  if ('error' in result) {
    console.error('[ToeflRepeat persist] summary failed:', result.error);
  }
}

/**
 * Reads all persisted messages for a TOEFL Listen & Repeat session.
 */
export async function getToeflRepeatSessionMessagesAction(
  sessionId: string,
  userId: string
) {
  return readSessionMessages(sessionId, userId);
}
