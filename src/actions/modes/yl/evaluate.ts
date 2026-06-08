'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { EvalResponseSchema, type EvalResponse, type ModeKey } from '@/lib/types/practice';
import { type YLTurnEvalResult } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { persistMessage } from '@/lib/persist-activity';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { parseYLMode, evaluationKey, reactionKey, EvalFallback } from './_helpers';
import { WhatsThisEvalResultSchema, WhatsThisEvalFallback } from './types';
import type { WhatsThisEvalResult } from './types';
import { saveYLTurnAction } from './persist';

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

export async function evaluateYLFinalAction(input: {
  sessionId: string;
  mode: ModeKey;
  turnsCount: number;
}): Promise<EvalResponse> {
  const { exam, part } = parseYLMode(input.mode);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'evaluateYLFinalAction', error: 'Not authenticated' }));
    return EvalFallback;
  }

  const { data: messages } = await supabase
    .from('bob_messages')
    .select('content_text, content_json, role, msg_type')
    .eq('session_id', input.sessionId)
    .eq('role', 'user')
    .order('created_at', { ascending: true });

  const transcript = (messages ?? [])
    .map(
      (m, i) =>
        `Turn ${i + 1}: ${(m.content_text as string) ?? (m.content_json as Record<string, unknown>)?.transcribed ?? ''}`
    )
    .join('\n');

  const promptText = await getPrompt(evaluationKey(exam, part), {
    USER_TRANSCRIPT: transcript,
    QUESTION: `Full session — ${input.turnsCount} turns`,
    STORY_BEAT: `Full session — ${input.turnsCount} turns`,
    DIFFERENCE: `Full session — ${input.turnsCount} turns`,
    AUDIO_DURATION_SECONDS: 30,
  });

  const result = await callGemini(
    { promptKey: evaluationKey(exam, part), model: MODELS.FLASH_LITE_PREVIEW, userId: user.id },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateYLFinalAction', error: result.ok ? 'empty response' : result.error }));
    return EvalFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return EvalFallback;
  }

  const evalResult = safeParseFallback(EvalResponseSchema, parsed, EvalFallback);

  await persistMessage({
    sessionId: input.sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { ...evalResult, is_final: true },
  });

  return evalResult;
}

export async function evaluateWhatsThisAnswerAction(input: {
  sessionId: string;
  cardIndex: number;
  questionIndex: number;
  question: string;
  questionType: 'what_is_this' | 'have_you_got';
  expected: string;
  audioBase64: string;
  mimeType: string;
  audioDuration: number;
}): Promise<WhatsThisEvalResult> {
  const cueIndex = input.cardIndex * 2 + input.questionIndex;

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
        cue: input.question,
        cueIndex,
        transcript: '',
        reaction: silenceResult.reaction,
      });
    } catch (err) {
      console.warn('[evaluateWhatsThisAnswerAction] saveYLTurnAction failed (silence):', err);
    }
    return silenceResult;
  }

  const transcribeResult = await callGemini(
    { promptKey: 'whats_this_transcribe', model: MODELS.FLASH_LITE_PREVIEW },
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

  const evalPromptText = await getPrompt('cambridge_starters_part3_a1_evaluation', {
    QUESTION: input.question,
    QUESTION_TYPE: input.questionType,
    EXPECTED: input.expected,
    USER_TRANSCRIPT: transcribed,
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const evalResult = await callGemini(
    { promptKey: 'cambridge_starters_part3_a1_evaluation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!evalResult.ok || !evalResult.data.text) {
    console.error(JSON.stringify({ event: 'evaluateWhatsThisAnswerAction', error: 'eval failed' }));
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(evalResult.data.text);
  } catch {
    console.error(JSON.stringify({ event: 'evaluateWhatsThisAnswerAction', error: 'invalid JSON' }));
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  const validated = WhatsThisEvalResultSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('[evaluateWhatsThisAnswerAction] schema mismatch:', validated.error.message);
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  const result: WhatsThisEvalResult = { ...validated.data, transcript: transcribed };

  try {
    await saveYLTurnAction(input.sessionId, {
      cue: input.question,
      cueIndex,
      transcript: transcribed,
      reaction: result.reaction,
    });
  } catch (err) {
    console.warn('[evaluateWhatsThisAnswerAction] saveYLTurnAction failed:', err);
  }

  return result;
}

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

export async function evaluateTellTheStoryAnswerAction(input: {
  sessionId: string;
  sceneIndex: number;
  examinerCue: string;
  expectedAnswer: string;
  expectedKeywords: string[];
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
      reaction: "I didn't hear you — let's keep going!",
      feedback: undefined,
      transcript_used: '',
      transcript: '',
    };
    try {
      await saveYLTurnAction(input.sessionId, {
        cue: input.examinerCue,
        cueIndex: input.sceneIndex,
        transcript: '',
        reaction: silenceResult.reaction,
      });
    } catch (err) {
      console.warn('[evaluateTellTheStoryAnswerAction] saveYLTurnAction failed (silence):', err);
    }
    return silenceResult;
  }

  const transcribeResult = await callGemini(
    { promptKey: 'tell_the_story_transcribe', model: MODELS.FLASH_LITE_PREVIEW },
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

  const evalPromptText = await getPrompt('cambridge_movers_part3_a1_evaluation', {
    EXAMINER_CUE: input.examinerCue,
    EXPECTED_ANSWER: input.expectedAnswer,
    EXPECTED_KEYWORDS: JSON.stringify(input.expectedKeywords),
    USER_TRANSCRIPT: transcribed,
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const evalResult = await callGemini(
    { promptKey: 'cambridge_movers_part3_a1_evaluation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: evalPromptText }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!evalResult.ok || !evalResult.data.text) {
    console.error(JSON.stringify({ event: 'evaluateTellTheStoryAnswerAction', error: 'eval failed' }));
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(evalResult.data.text);
  } catch {
    console.error(JSON.stringify({ event: 'evaluateTellTheStoryAnswerAction', error: 'invalid JSON' }));
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  const validated = WhatsThisEvalResultSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('[evaluateTellTheStoryAnswerAction] schema mismatch:', validated.error.message);
    return { ...WhatsThisEvalFallback, transcript: transcribed };
  }

  const result: WhatsThisEvalResult = { ...validated.data, transcript: transcribed };

  try {
    await saveYLTurnAction(input.sessionId, {
      cue: input.examinerCue,
      cueIndex: input.sceneIndex,
      transcript: transcribed,
      reaction: result.reaction,
    });
  } catch (err) {
    console.warn('[evaluateTellTheStoryAnswerAction] saveYLTurnAction failed:', err);
  }

  return result;
}
