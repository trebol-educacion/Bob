'use server';

import { z } from 'zod';
import { GoogleGenAI, Type, Part } from '@google/genai';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { RepetitionEvaluationSchema, RepetitionEvaluation } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';

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

/**
 * Generates 10 progressive TOEFL Listen & Repeat items and persists the phrase plan.
 */
export async function generateToeflRepeatSessionAction(
  sessionId: string,
  userId: string
): Promise<ToeflRepeatItem[]> {
  const ai = getAiClient();
  const prompt = await getPrompt('toefl_listen_repeat_b1_generation');

  const response = await ai.models.generateContent({
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
  });

  const raw = response.text ?? '';
  const parsed = ToeflRepeatSessionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid TOEFL session data: ${parsed.error.message}`);
  }

  const items = parsed.data.items;

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: { phrases: items },
  });
  if ('error' in persistResult) {
    console.error('[ToeflRepeat persist] phrase plan failed:', persistResult.error);
  }

  return items;
}

/**
 * Pre-generates TTS audio for all phrases in parallel (max concurrency 3).
 * Returns raw PCM base64 + mimeType for each phrase — client converts to WAV.
 */
export async function generateToeflRepeatAudiosAction(
  phrases: string[]
): Promise<ToeflAudioChunk[]> {
  const ai = getAiClient();
  const CONCURRENCY = 3;
  const results: ToeflAudioChunk[] = [];

  const generateOne = async (phrase: string): Promise<ToeflAudioChunk> => {
    const response = await ai.models.generateContent({
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
            prebuiltVoiceConfig: {
              voiceName: 'Sadaltager',
            },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find((p: Part) => p.inlineData);

    if (!audioPart?.inlineData?.data) {
      throw new Error(`No audio data received for phrase: "${phrase}"`);
    }

    return {
      data: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType ?? 'audio/L16;codec=pcm;rate=24000',
    };
  };

  for (let i = 0; i < phrases.length; i += CONCURRENCY) {
    const batch = phrases.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(generateOne));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Evaluates a user's repetition attempt and persists the audio attempt + per-item result.
 */
export async function evaluateRepetitionAction(
  originalText: string,
  audioBase64: string,
  mimeType: string,
  sessionId: string,
  userId: string,
  phraseIndex: number
): Promise<RepetitionEvaluation> {
  const ai = getAiClient();
  const prompt = await getPrompt('toefl_listen_repeat_b1_evaluation', { TARGET_SENTENCE: originalText, TARGET_DURATION_SECONDS: 0, USER_TRANSCRIPT: '' });

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          accuracy: { type: Type.NUMBER },
          pronunciation: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          transcribed_text: { type: Type.STRING },
          original_text: { type: Type.STRING },
        },
        required: ['score', 'accuracy', 'pronunciation', 'feedback', 'transcribed_text', 'original_text'],
      },
    },
  });

  const raw = response.text ?? '';
  const parsed = RepetitionEvaluationSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid repetition evaluation: ${parsed.error.message}`);
  }

  const evaluation = parsed.data;

  const audioResult = await persistMessage({
    sessionId,
    userId,
    role: 'user',
    msgType: 'user_audio',
    contentText: evaluation.transcribed_text || null,
    contentJson: { phraseIndex, accuracy: evaluation.accuracy },
  });
  if ('error' in audioResult) {
    console.error('[ToeflRepeat persist] user_audio failed:', audioResult.error);
  }

  const evalResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { phraseIndex, ...evaluation },
  });
  if ('error' in evalResult) {
    console.error('[ToeflRepeat persist] evaluation failed:', evalResult.error);
  }

  return evaluation;
}

/**
 * Persists the session-level summary after all items are completed.
 */
export async function saveToeflRepeatSummaryAction(
  sessionId: string,
  userId: string,
  summary: { avgScore: number; avgAccuracy: number; avgPronunciation: number; itemCount: number }
): Promise<void> {
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: `Session complete. Average score: ${summary.avgScore.toFixed(2)}`,
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
