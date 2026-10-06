'use server';

import { Type, Part } from '@google/genai';
import { MODELS } from '@/lib/models';
import { RepetitionObjectiveFeedbackSchema, type RepetitionObjectiveFeedback } from '@/lib/types/practice';
import { ToeflRepeatSessionSchema, REPEAT_ANSWER_KIND, buildRepeatEvaluation, restoreRepeat, type ToeflRepeatItem } from '@/lib/toefl/repeat';
import { currentUserId, finishSession, openSession, recordTurn } from '@/lib/session/lifecycle';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { readSessionMessages } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { fail, ok } from '@/lib/result';
import { parseJsonResult } from '@/lib/llm/parse-json-result';
import { callGemini } from '@/lib/gemini-client';

export type ToeflAudioChunk = {
  data: string;
  mimeType: string;
};

const SessionFallback: ToeflRepeatItem[] = Array.from({ length: 10 }, (_, i) => ({
  text: `Please repeat this sentence clearly and naturally. Number ${i + 1}.`,
  difficulty: Math.min(5, Math.floor(i / 2) + 1),
}));

/** Generates 10 progressive TOEFL Listen & Repeat items; persists nothing until the first graded repetition. */
export async function generateToeflRepeatSessionAction(): Promise<ToeflRepeatItem[]> {
  const userId = (await currentUserId()) ?? undefined;
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

      const parsed = parseJsonResult(result, ToeflRepeatSessionSchema, 'generateToeflRepeatSessionAction');
      return parsed.ok ? ok(parsed.data.items) : parsed;
    },
    { storeAs: 'json', validate: (items) => ToeflRepeatSessionSchema.safeParse({ items }).success }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateToeflRepeatSessionAction_cache', error: cached.error }));
    return SessionFallback;
  }

  return cached;
}

/**
 * Pre-generates TTS audio for all phrases in parallel (max concurrency 3).
 * Returns raw PCM base64 + mimeType for each phrase, client converts to WAV.
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
          return fail(result.code, result.retryable);
        }

        const audioPart = result.data.candidates?.[0]?.content?.parts?.find((p: Part) => p.inlineData);

        if (!audioPart?.inlineData?.data) {
          console.error(JSON.stringify({ event: 'generateToeflRepeatAudiosAction', phrase: phrase.slice(0, 40), error: 'no audio data' }));
          return fail('empty_audio', true);
        }

        return ok({
          data: audioPart.inlineData.data,
          mimeType: audioPart.inlineData.mimeType ?? 'audio/L16;codec=pcm;rate=24000',
        });
      },
      { storeAs: 'json', validate: (chunk) => chunk.data.length > 0 }
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

const MODE = 'toefl_listen_repeat';

export interface RepetitionInput {
  items: ToeflRepeatItem[];
  phraseIndex: number;
  audioBase64: string;
  mimeType: string;
  sessionId?: string;
}

export interface RepetitionOutcome {
  sessionId: string;
  feedback: RepetitionObjectiveFeedback;
}

async function evaluateRepetition(originalText: string, audioBase64: string, mimeType: string): Promise<RepetitionObjectiveFeedback | null> {
  const prompt = `You are evaluating a Listen & Repeat exercise.

Target sentence: "${originalText}"

Listen to the audio and transcribe what the student said. Then compare word by word.

Return ONLY a JSON object with these fields:
- "kind": always "repetition_objective"
- "exact_repetition": boolean, true only if every word matches exactly (case-insensitive)
- "missing_words": array of words from the target sentence that were omitted
- "extra_words": array of words the student said that are not in the target sentence
- "transcribed_text": what the student actually said (verbatim transcription)
- "original_text": "${originalText}"

Return ONLY valid JSON. No score, no pronunciation rating, no subjective assessment.`;

  const userId = (await currentUserId()) ?? undefined;
  const result = await callGemini(
    { promptKey: 'toefl_listen_repeat_b1_objective', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );
  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateRepetition', error: result.ok ? 'empty response' : result.error }));
    return null;
  }
  try {
    const parsed = RepetitionObjectiveFeedbackSchema.safeParse(JSON.parse(result.data.text));
    return parsed.success ? { ...parsed.data, original_text: originalText } : null;
  } catch {
    return null;
  }
}

/** Evaluates a repetition objectively; opens the session on the first graded attempt and persists the turn. */
export async function submitRepetitionAction(input: RepetitionInput): Promise<RepetitionOutcome | { error: string }> {
  const item = input.items[input.phraseIndex];
  if (!item) return { error: 'invalid_item' };
  const feedback = await evaluateRepetition(item.text, input.audioBase64, input.mimeType);
  if (!feedback) return { error: 'evaluation_failed' };

  const opened = await openSession({
    mode: MODE,
    sessionId: input.sessionId,
    opening: [{ role: 'bob', msgType: 'phrase', contentJson: { phrases: input.items } }],
  });
  if (!opened.ok) return { error: opened.code };

  const turn = await recordTurn({
    ...opened.data,
    messages: [
      {
        role: 'user',
        msgType: 'text',
        contentText: feedback.transcribed_text || null,
        contentJson: { kind: REPEAT_ANSWER_KIND, phraseIndex: input.phraseIndex, exact_repetition: feedback.exact_repetition },
      },
      { role: 'bob', msgType: 'evaluation', contentJson: { phraseIndex: input.phraseIndex, ...feedback } },
    ],
  });
  if (!turn.ok) return { error: turn.code };
  return { sessionId: opened.data.sessionId, feedback };
}

/** Closes the session with the 0-10 grade from exact repetitions over the item count. */
export async function finishToeflRepeatAction(sessionId: string): Promise<{ score10: number | null } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const restored = restoreRepeat(await readSessionMessages(sessionId, userId));
  if (!restored) return { error: 'nothing_to_grade' };
  const finished = await finishSession({
    sessionId,
    userId,
    evaluation: buildRepeatEvaluation(restored.evaluations, restored.items.length),
  });
  return finished.ok ? { score10: finished.data.score10 } : { error: finished.code };
}
