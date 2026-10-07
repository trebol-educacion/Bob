'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';
import { validateRecordedAudio } from '@/lib/audio-guard';
import { EvaluationSchema, type PETPictureDescriptionFeedback, type PETPictureDescriptionResult } from './contracts';
import { bankStamp } from '@/lib/item-bank/plan-bank';
import { safeParse } from './shared';

export async function evaluatePETPictureDescriptionAction(input: {
  sessionId?: string;
  plan: PETPictureDescriptionResult;
  audioBlob: Blob;
  mimeType: string;
  audioDuration: number;
}): Promise<PETPictureDescriptionFeedback | { error: string }> {
  const tStart = Date.now();
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const { plan } = input;
  const audioBytes = input.audioBlob.size;
  console.log(JSON.stringify({
    event: 'pet_p2_evaluate_start',
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
    minDurationSeconds: 1.0,
  });

  if (!guard.ok) {
    console.warn(JSON.stringify({
      event: 'pet_p2_audio_guard_failed',
        reason: guard.reason,
      audioBytes,
      audioDurationSec: input.audioDuration,
    }));
    return { error: 'audio_required' };
  }

  const arrayBuffer = await input.audioBlob.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
  console.log(JSON.stringify({
    event: 'pet_p2_audio_prepared',
    audioBytes,
    base64Length: audioBase64.length,
  }));

  const tEvalStart = Date.now();
  const evalPromptText = await getPrompt('cambridge_pet_p2_b1_evaluation', {
    TOPIC: plan.topic,
    SCENE_PROMPT: plan.scenePrompt,
    REFERENCE_VOCABULARY: JSON.stringify(plan.referenceVocabulary),
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const evalResult = await callGemini(
    { promptKey: 'cambridge_pet_p2_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
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
    event: 'pet_p2_eval_response',
    ok: evalResult.ok,
    latencyMs: Date.now() - tEvalStart,
  }));

  if (!evalResult.ok) {
    console.error(JSON.stringify({
      event: 'pet_p2_eval_failed',
        error: 'callGemini not ok',
    }));
    return { error: 'Could not evaluate recording' };
  }

  const evalRaw = evalResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const feedback = safeParse(EvaluationSchema, evalRaw);

  if (!feedback) {
    console.error(JSON.stringify({
      event: 'pet_p2_eval_parse_failed',
        rawPreview: evalRaw.slice(0, 200),
    }));
    return { error: 'Unexpected evaluation response' };
  }

  const transcript = (feedback.transcript || feedback.transcript_used || '').trim();
  const coverageHits = Object.values(feedback.coverage).filter(Boolean).length;
  console.log(JSON.stringify({
    event: 'pet_p2_eval_parsed',
    understood: feedback.understood,
    coverageHits,
    coverageTotal: 8,
    fluencyBand: feedback.fluency_band,
    transcriptLength: transcript.length,
    transcriptPreview: transcript.slice(0, 120),
    highlightsCount: feedback.highlights.length,
    suggestionsCount: feedback.suggestions.length,
    totalLatencyMs: Date.now() - tStart,
  }));

  const completed = await completeActivity({
    mode: 'cambridge_pet_p2',
    sessionId: input.sessionId,
    bank: bankStamp('pet_p2', plan.bankGroupId),
    plan: {
      kind: 'picture_description_plan',
      topic: plan.topic,
      framing_text: plan.framingText,
      scene_prompt: plan.scenePrompt,
      reference_vocabulary: plan.referenceVocabulary,
      language_bank: plan.languageBank,
      image_url: plan.imageUrl,
    },
    answers: [{ kind: 'speaking_submission', transcript, audio_duration_seconds: input.audioDuration }],
    evaluation: {
      kind: 'picture_description_feedback',
      understood: feedback.understood,
      highlights: feedback.highlights,
      suggestions: feedback.suggestions,
      coverage: feedback.coverage,
      fluency_band: feedback.fluency_band,
      transcript_used: feedback.transcript_used,
      rubric: feedback.rubric ?? null,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { ...feedback, transcript, rubric: feedback.rubric, sessionId: completed.data.sessionId };
}

