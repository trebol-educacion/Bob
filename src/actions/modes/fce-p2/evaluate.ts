'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { persistMessages } from '@/lib/persist-activity';
import { MODELS } from '@/lib/models';
import { validateRecordedAudio } from '@/lib/audio-guard';
import { EvaluationSchema, type FCELongTurnReferenceVocabulary, type FCELongTurnFeedback } from './contracts';
import { safeParse } from './shared';

/**
 * Evaluates a student's audio recording for FCE Part 2 Long Turn.
 * Transcribes the audio, runs qualitative evaluation, and persists both.
 * Returns an error discriminant when audio guard fails.
 */
export async function evaluateFCEPictureDescriptionAction(input: {
  sessionId: string;
  userId: string;
  topic: string;
  comparisonQuestion: string;
  scenePromptA: string;
  scenePromptB: string;
  referenceVocabulary: FCELongTurnReferenceVocabulary;
  audioBlob: Blob;
  mimeType: string;
  audioDuration: number;
}): Promise<FCELongTurnFeedback | { error: string }> {
  const tStart = Date.now();
  const audioBytes = input.audioBlob.size;
  console.log(JSON.stringify({
    event: 'fce_p2_evaluate_start',
    sessionId: input.sessionId,
    userId: input.userId,
    topic: input.topic,
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
      sessionId: input.sessionId,
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
    sessionId: input.sessionId,
    audioBytes,
    base64Length: audioBase64.length,
  }));

  const tEvalStart = Date.now();
  const evalPromptText = await getPrompt('cambridge_fce_p2_b2_evaluation', {
    TOPIC: input.topic,
    COMPARISON_QUESTION: input.comparisonQuestion,
    SCENE_A: input.scenePromptA,
    SCENE_B: input.scenePromptB,
    REFERENCE_VOCABULARY: JSON.stringify(input.referenceVocabulary),
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const evalResult = await callGemini(
    { promptKey: 'cambridge_fce_p2_b2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
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
    sessionId: input.sessionId,
    ok: evalResult.ok,
    latencyMs: Date.now() - tEvalStart,
  }));

  if (!evalResult.ok) {
    console.error(JSON.stringify({
      event: 'fce_p2_eval_failed',
      sessionId: input.sessionId,
      error: 'callGemini not ok',
    }));
    return { error: 'Could not evaluate recording' };
  }

  const evalRaw = evalResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const feedback = safeParse(EvaluationSchema, evalRaw);

  if (!feedback) {
    console.error(JSON.stringify({
      event: 'fce_p2_eval_parse_failed',
      sessionId: input.sessionId,
      rawPreview: evalRaw.slice(0, 200),
    }));
    return { error: 'Unexpected evaluation response' };
  }

  const transcript = (feedback.transcript || feedback.transcript_used || '').trim();
  const coverageHits = Object.values(feedback.coverage).filter(Boolean).length;
  console.log(JSON.stringify({
    event: 'fce_p2_eval_parsed',
    sessionId: input.sessionId,
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

  persistMessages([
    {
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user',
      msgType: 'text',
      contentText: transcript,
      contentJson: {
        kind: 'fce_long_turn_submission',
        transcript,
        audio_duration_seconds: input.audioDuration,
      },
    },
    {
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'bob',
      msgType: 'evaluation',
      contentText: null,
      contentJson: {
        kind: 'fce_long_turn_feedback',
        understood: feedback.understood,
        highlights: feedback.highlights,
        suggestions: feedback.suggestions,
        coverage: feedback.coverage,
        fluency_band: feedback.fluency_band,
        language_band: feedback.language_band,
        transcript_used: feedback.transcript_used,
        rubric: feedback.rubric ?? null,
        is_final: true,
      },
    },
  ])
    .then(() => console.log(JSON.stringify({
      event: 'fce_p2_persist_done',
      sessionId: input.sessionId,
    })))
    .catch((err) => console.warn(JSON.stringify({
      event: 'fce_p2_persist_failed',
      sessionId: input.sessionId,
      error: String(err),
    })));

  return { ...feedback, transcript, rubric: feedback.rubric };
}

