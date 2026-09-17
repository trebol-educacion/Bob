'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { EvalResponseSchema, type EvalResponse, type ModeKey } from '@/lib/types/practice';
import { type YLTurnEvalResult } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { parseYLMode, evaluationKey, reactionKey, EvalFallback } from '../_helpers';

const YLTurnEvalSchema = EvalResponseSchema.extend({
  reaction: z.string(),
});

export async function evaluateYLTurnAction(input: {
  mode: ModeKey;
  audioBase64: string;
  mimeType: string;
  audioDuration: number;
  cue: string;
  sessionId: string;
  cueIndex: number;
}): Promise<YLTurnEvalResult> {
  const { exam, part } = parseYLMode(input.mode);

  const transcribeResult = await callGemini(
    { promptKey: `${exam}_part${part}_a1_transcribe`, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Transcribe exactly what the child says in English. Output only the transcription, nothing else. If nothing was said, output "(silence)".` },
            { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
          ],
        },
      ],
    })
  );
  const transcribed = transcribeResult.ok ? (transcribeResult.data.text ?? '(silence)').trim() : '(silence)';

  const sharedParams = {
    USER_TRANSCRIPT: transcribed,
    QUESTION: input.cue,
    EXAMINER_CUE: input.cue,
    STORY_BEAT: input.cue,
    DIFFERENCE: input.cue,
    PERSONAL_QUESTION: input.cue,
    CUE: input.cue,
    SCENE_QUESTION: input.cue,
    AUDIO_DURATION_SECONDS: input.audioDuration,
  } as const;
  const evalPrompt = await getPrompt(evaluationKey(exam, part), sharedParams);
  const reactionPrompt = await getPrompt(reactionKey(exam, part), sharedParams);

  const [evalResult, reactionResult] = await Promise.all([
    callGemini(
      { promptKey: evaluationKey(exam, part), model: MODELS.FLASH_LITE_PREVIEW },
      (ai) => ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: evalPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
    ),
    callGemini(
      { promptKey: reactionKey(exam, part), model: MODELS.FLASH_LITE_PREVIEW },
      (ai) => ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: reactionPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
    ),
  ]);

  let reaction = 'Great job! 🌟';
  if (reactionResult.ok && reactionResult.data.text) {
    try {
      const reactionJson = JSON.parse(reactionResult.data.text) as { reaction?: string };
      if (reactionJson.reaction && reactionJson.reaction.trim()) {
        reaction = reactionJson.reaction.trim();
      }
    } catch {
      const raw = reactionResult.data.text.trim();
      if (raw) reaction = raw;
    }
  }

  if (!evalResult.ok || !evalResult.data.text) {
    console.error(JSON.stringify({ event: 'evaluateYLTurnAction', error: evalResult.ok ? 'empty response' : evalResult.error }));
    return { ...EvalFallback, reaction, transcript: transcribed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(evalResult.data.text);
  } catch {
    console.error('[evaluateYLTurnAction] Failed to parse eval JSON');
    return { ...EvalFallback, reaction, transcript: transcribed };
  }

  const result = EvalResponseSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[evaluateYLTurnAction] Invalid eval schema:', result.error.message);
    return { ...EvalFallback, reaction, transcript: transcribed };
  }

  return { ...result.data, reaction, transcript: transcribed };
}

