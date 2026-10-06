'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { currentUserId, finishSession, openSession, recordTurn } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';
import { validateRecordedAudio } from '@/lib/audio-guard';
import { EvaluationSchema, type FCELongTurnResult, type FCELongTurnSubmission } from './contracts';
import { safeParse } from './shared';

const FCE_P2_MODE = 'cambridge_fce_p2';

/**
 * Evaluates a student's audio recording for FCE Part 2 Long Turn.
 * Transcribes the audio, runs qualitative evaluation, and persists both.
 * Returns an error discriminant when audio guard fails.
 */
export async function evaluateFCEPictureDescriptionAction(input: {
  sessionId?: string;
  plan: FCELongTurnResult;
  audioBlob: Blob;
  mimeType: string;
  audioDuration: number;
}): Promise<FCELongTurnSubmission | { error: string }> {
  const tStart = Date.now();
  const userId = await currentUserId();
  if (!userId) return { error: 'Not authenticated' };
  const { plan } = input;
  const audioBytes = input.audioBlob.size;
  console.log(JSON.stringify({
    event: 'fce_p2_evaluate_start',
    userId,
    topic: plan.topic,
    audioBytes,
    audioDurationSec: input.audioDuration,
    mimeType: input.mimeType,
  }));

  const guard = validateRecordedAudio({
    blob: input.audioBlob,
    durationSeconds: input.audioDuration,
    minBytes: 1024,
    minDurationSeconds: 1.5,
  });

  if (!guard.ok) {
    console.warn(JSON.stringify({
      event: 'fce_p2_audio_guard_failed',
      reason: guard.reason,
      audioBytes,
      audioDurationSec: input.audioDuration,
    }));
    return { error: 'audio_required' };
  }

  const arrayBuffer = await input.audioBlob.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
  console.log(JSON.stringify({
    event: 'fce_p2_audio_prepared',
    audioBytes,
    base64Length: audioBase64.length,
  }));

  const tEvalStart = Date.now();
  const evalPromptText = await getPrompt('cambridge_fce_p2_b2_evaluation', {
    TOPIC: plan.topic,
    COMPARISON_QUESTION: plan.comparisonQuestion,
    SCENE_A: plan.scenePromptA,
    SCENE_B: plan.scenePromptB,
    REFERENCE_VOCABULARY: JSON.stringify(plan.referenceVocabulary),
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const evalResult = await callGemini(
    { promptKey: 'cambridge_fce_p2_b2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [
          {
            role: 'user',
            parts: [
              { text: evalPromptText },
              { inlineData: { mimeType: input.mimeType, data: audioBase64 } },
            ],
          },
        ],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  console.log(JSON.stringify({
    event: 'fce_p2_eval_response',
    ok: evalResult.ok,
    latencyMs: Date.now() - tEvalStart,
  }));

  if (!evalResult.ok) {
    console.error(JSON.stringify({
      event: 'fce_p2_eval_failed',
      error: 'callGemini not ok',
    }));
    return { error: 'Could not evaluate recording' };
  }

  const evalRaw = evalResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const feedback = safeParse(EvaluationSchema, evalRaw);

  if (!feedback) {
    console.error(JSON.stringify({
      event: 'fce_p2_eval_parse_failed',
      rawPreview: evalRaw.slice(0, 200),
    }));
    return { error: 'Unexpected evaluation response' };
  }

  const transcript = (feedback.transcript || feedback.transcript_used || '').trim();
  const coverageHits = Object.values(feedback.coverage).filter(Boolean).length;
  console.log(JSON.stringify({
    event: 'fce_p2_eval_parsed',
    understood: feedback.understood,
    coverageHits,
    coverageTotal: 6,
    fluencyBand: feedback.fluency_band,
    languageBand: feedback.language_band,
    transcriptLength: transcript.length,
    transcriptPreview: transcript.slice(0, 120),
    highlightsCount: feedback.highlights.length,
    suggestionsCount: feedback.suggestions.length,
    totalLatencyMs: Date.now() - tStart,
  }));

  const session = await openSession({
    mode: FCE_P2_MODE,
    sessionId: input.sessionId,
    opening: [
      {
        role: 'bob',
        msgType: 'text',
        contentText: null,
        contentJson: {
          kind: 'fce_long_turn_plan',
          exam_part: 'fce_speaking_part2',
          bank_group_id: plan.bankGroupId,
          topic: plan.topic,
          framing_text: plan.framingText,
          comparison_question: plan.comparisonQuestion,
          scene_prompt_a: plan.scenePromptA,
          scene_prompt_b: plan.scenePromptB,
          reference_vocabulary: plan.referenceVocabulary,
          language_bank: plan.languageBank,
          image_url_a: plan.imageUrlA,
          image_url_b: plan.imageUrlB,
        },
      },
    ],
  });
  if (!session.ok) return { error: session.code };

  const turn = await recordTurn({
    ...session.data,
    messages: [
      {
        role: 'user',
        msgType: 'text',
        contentText: transcript,
        contentJson: {
          kind: 'fce_long_turn_submission',
          transcript,
          audio_duration_seconds: input.audioDuration,
        },
      },
    ],
  });
  if (!turn.ok) return { error: turn.code };

  const finished = await finishSession({
    ...session.data,
    evaluation: {
      kind: 'fce_long_turn_feedback',
      understood: feedback.understood,
      highlights: feedback.highlights,
      suggestions: feedback.suggestions,
      coverage: feedback.coverage,
      fluency_band: feedback.fluency_band,
      language_band: feedback.language_band,
      transcript_used: feedback.transcript_used,
      rubric: feedback.rubric ?? null,
    },
  });
  if (!finished.ok) return { error: finished.code };

  return {
    sessionId: session.data.sessionId,
    feedback: { ...feedback, transcript, rubric: feedback.rubric },
  };
}
