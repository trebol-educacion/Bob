'use server';

import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { WhatsThisEvalResultSchema, WhatsThisEvalFallback } from '../types';
import type { WhatsThisEvalResult } from '../types';
import { saveYLTurnAction } from '../persist';

export async function evaluateFindDifferencesAnswerAction(input: {
  sessionId: string;
  turnIndex: number;
  examinerCue: string;
  expectedAnswer: string;
  audioBase64: string;
  mimeType: string;
  audioDuration: number;
}): Promise<WhatsThisEvalResult> {
  if (input.audioDuration <= 0.15) {
    const silenceResult: WhatsThisEvalResult = {
      score: 0,
      score_max: 1,
      cefr_band: 'a1',
      correct: false,
      reaction: "I didn't hear you — try again!",
      feedback: undefined,
      transcript_used: '',
      transcript: '',
    };
    try {
      await saveYLTurnAction(input.sessionId, {
        cue: input.examinerCue,
        cueIndex: input.turnIndex,
        transcript: '',
        reaction: silenceResult.reaction,
      });
    } catch (err) {
      console.warn('[evaluateFindDifferencesAnswerAction] saveYLTurnAction failed (silence):', err);
    }
    return silenceResult;
  }

  const transcribeResult = await callGemini(
    { promptKey: 'find_differences_transcribe', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Transcribe exactly what the child says in English. Output only the transcription, nothing else. If nothing was said, output "(silence)".' },
            { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
          ],
        },
      ],
    })
  );
  const transcribed = transcribeResult.ok
    ? (transcribeResult.data.text ?? '(silence)').trim()
    : '(silence)';

  const evalPromptText = await getPrompt('cambridge_movers_part1_a1_evaluation', {
    EXAMINER_CUE: input.examinerCue,
    EXPECTED_ANSWER: input.expectedAnswer,
    USER_TRANSCRIPT: transcribed,
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const evalResult = await callGemini(
    { promptKey: 'cambridge_movers_part1_a1_evaluation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!evalResult.ok || !evalResult.data.text) {
    console.error(JSON.stringify({ event: 'evaluateFindDifferencesAnswerAction', error: 'eval failed' }));
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(evalResult.data.text);
  } catch {
    console.error(JSON.stringify({ event: 'evaluateFindDifferencesAnswerAction', error: 'invalid JSON' }));
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  const validated = WhatsThisEvalResultSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('[evaluateFindDifferencesAnswerAction] schema mismatch:', validated.error.message);
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  const result: WhatsThisEvalResult = { ...validated.data, transcript: transcribed };

  try {
    await saveYLTurnAction(input.sessionId, {
      cue: input.examinerCue,
      cueIndex: input.turnIndex,
      transcript: transcribed,
      reaction: result.reaction,
    });
  } catch (err) {
    console.warn('[evaluateFindDifferencesAnswerAction] saveYLTurnAction failed:', err);
  }

  return result;
}

