'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { validateRecordedAudio } from '@/lib/audio-guard';

const B2_PICTURE_TOPICS = [
  'Sport',
  'Travel',
  'Work',
  'Family',
  'Education',
  'Technology',
  'Environment',
  'Free time',
  'Health',
  'Food',
] as const;

function pickRandomTopic(): string {
  return B2_PICTURE_TOPICS[Math.floor(Math.random() * B2_PICTURE_TOPICS.length)];
}

const GenerationSchema = z.object({
  topic: z.string(),
  comparison_question: z.string(),
  scene_prompt_a: z.string(),
  scene_prompt_b: z.string(),
  reference_vocabulary: z.object({
    comparison: z.array(z.string()),
    speculation: z.array(z.string()),
    activity_verbs: z.array(z.string()),
    emotions: z.array(z.string()),
    settings: z.array(z.string()),
  }),
  language_bank: z.object({
    openers: z.array(z.string()),
    contrast: z.array(z.string()),
    speculation: z.array(z.string()),
    conclusion: z.array(z.string()),
  }),
});

export type FCELongTurnReferenceVocabulary = {
  comparison: string[];
  speculation: string[];
  activity_verbs: string[];
  emotions: string[];
  settings: string[];
};

export type FCELongTurnLanguageBank = {
  openers: string[];
  contrast: string[];
  speculation: string[];
  conclusion: string[];
};

/** Full result returned after a successful generate call. */
export interface FCELongTurnResult {
  sessionId: string;
  userId: string;
  topic: string;
  framingText: string;
  comparisonQuestion: string;
  scenePromptA: string;
  scenePromptB: string;
  referenceVocabulary: FCELongTurnReferenceVocabulary;
  languageBank: FCELongTurnLanguageBank;
  imageUrlA: string;
  imageUrlB: string;
}

const RubricSchema = z
  .object({
    task_coverage: z.number().int().min(0).max(4),
    grammar:       z.number().int().min(0).max(4),
    vocabulary:    z.number().int().min(0).max(4),
    fluency:       z.number().int().min(0).max(4),
  })
  .optional();

const EvaluationSchema = z.object({
  transcript:     z.string().default(''),
  understood:     z.boolean(),
  highlights:     z.array(z.string()),
  suggestions:    z.array(z.string()),
  coverage: z.object({
    introduction:      z.boolean(),
    comparison:        z.boolean(),
    contrast:          z.boolean(),
    speculation:       z.boolean(),
    addressed_question: z.boolean(),
    conclusion:        z.boolean(),
  }),
  fluency_band:    z.enum(['OK', 'Good', 'Excellent']),
  language_band:   z.enum(['OK', 'Good', 'Excellent']),
  transcript_used: z.string(),
  rubric:          RubricSchema,
});

/** Qualitative feedback for a FCE Long Turn attempt. */
export interface FCELongTurnFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  coverage: {
    introduction: boolean;
    comparison: boolean;
    contrast: boolean;
    speculation: boolean;
    addressed_question: boolean;
    conclusion: boolean;
  };
  fluency_band: 'OK' | 'Good' | 'Excellent';
  language_band: 'OK' | 'Good' | 'Excellent';
  transcript_used: string;
  transcript: string;
  rubric?: z.infer<typeof RubricSchema>;
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Generates a Long Turn task for FCE B2 Part 2.
 * Creates a session when none is provided. Persists the plan as a bob message.
 */
export async function generateFCEPictureDescriptionAction(input: {
  sessionId?: string;
}): Promise<FCELongTurnResult | { error: string }> {
  const tStart = Date.now();
  console.log(JSON.stringify({
    event: 'fce_p2_generate_start',
    incomingSessionId: input.sessionId ?? null,
  }));

  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_fce_p2',
      title: 'Speaking Part 2 — Long Turn',
    });
    if (!result.data) {
      console.error(JSON.stringify({
        event: 'fce_p2_generate_session_failed',
        error: result.error,
      }));
      return { error: result.error ?? 'Could not create session' };
    }
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn(JSON.stringify({
        event: 'fce_p2_generate_no_auth',
        sessionId,
      }));
      return { error: 'Not authenticated' };
    }
    userId = user.id;
  }

  const topic = pickRandomTopic();
  console.log(JSON.stringify({
    event: 'fce_p2_topic_picked',
    sessionId,
    userId,
    topic,
  }));

  const [generationPromptText, framingText] = await Promise.all([
    getPrompt('cambridge_fce_p2_b2_generation', { TOPIC: topic }).catch(() => null),
    getPrompt('cambridge_fce_p2_b2_framing').catch(() => ''),
  ]);

  if (!generationPromptText) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_fce_p2_b2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPromptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) {
    return { error: 'Could not generate scenes' };
  }

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    return { error: 'Unexpected model response for generation' };
  }

  const tImgStart = Date.now();
  console.log(JSON.stringify({
    event: 'fce_p2_image_request',
    sessionId,
    sceneAPreview: parsed.scene_prompt_a.slice(0, 80),
    sceneBPreview: parsed.scene_prompt_b.slice(0, 80),
  }));

  const imageUrls = await generateYLImagesParallelAction(
    'starters',
    2,
    [parsed.scene_prompt_a, parsed.scene_prompt_b],
    sessionId,
    undefined,
    'photo_realistic'
  );
  const imageUrlA = imageUrls[0] ?? '';
  const imageUrlB = imageUrls[1] ?? '';

  console.log(JSON.stringify({
    event: 'fce_p2_image_done',
    sessionId,
    latencyMs: Date.now() - tImgStart,
    imageAReady: !!imageUrlA,
    imageBReady: !!imageUrlB,
  }));

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'fce_long_turn_plan',
      topic: parsed.topic,
      framing_text: framingText,
      comparison_question: parsed.comparison_question,
      scene_prompt_a: parsed.scene_prompt_a,
      scene_prompt_b: parsed.scene_prompt_b,
      reference_vocabulary: parsed.reference_vocabulary,
      language_bank: parsed.language_bank,
      image_url_a: imageUrlA,
      image_url_b: imageUrlB,
    },
  }).catch((err) => console.warn(JSON.stringify({
    event: 'fce_p2_persist_plan_failed',
    sessionId,
    error: String(err),
  })));

  console.log(JSON.stringify({
    event: 'fce_p2_generate_done',
    sessionId,
    userId,
    topic: parsed.topic,
    totalLatencyMs: Date.now() - tStart,
  }));

  return {
    sessionId,
    userId,
    topic: parsed.topic,
    framingText,
    comparisonQuestion: parsed.comparison_question,
    scenePromptA: parsed.scene_prompt_a,
    scenePromptB: parsed.scene_prompt_b,
    referenceVocabulary: parsed.reference_vocabulary,
    languageBank: parsed.language_bank,
    imageUrlA,
    imageUrlB,
  };
}

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

/**
 * Lazily fetches a B2 model answer after feedback is shown.
 * Intentionally decoupled from the evaluate call to avoid blocking the feedback phase.
 */
export async function getFCEPictureDescriptionModelAnswerAction(input: {
  topic: string;
  scenePromptA: string;
  scenePromptB: string;
  comparisonQuestion: string;
}): Promise<{ modelAnswer: string } | { error: string }> {
  const tStart = Date.now();
  console.log(JSON.stringify({
    event: 'fce_p2_model_answer_start',
    topic: input.topic,
  }));

  const promptText = await getPrompt('cambridge_fce_p2_b2_model_answer', {
    TOPIC: input.topic,
    SCENE_A: input.scenePromptA,
    SCENE_B: input.scenePromptB,
    COMPARISON_QUESTION: input.comparisonQuestion,
  }).catch(() => null);

  if (!promptText) {
    console.error(JSON.stringify({
      event: 'fce_p2_model_answer_prompt_failed',
      topic: input.topic,
    }));
    return { error: 'Could not load model answer prompt' };
  }

  const result = await callGemini(
    { promptKey: 'cambridge_fce_p2_b2_model_answer', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(result)) {
    console.error(JSON.stringify({
      event: 'fce_p2_model_answer_failed',
      topic: input.topic,
      latencyMs: Date.now() - tStart,
    }));
    return { error: 'Could not generate model answer' };
  }

  const raw = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(z.object({ model_answer: z.string() }), raw);

  if (!parsed) {
    console.error(JSON.stringify({
      event: 'fce_p2_model_answer_parse_failed',
      topic: input.topic,
      rawPreview: raw.slice(0, 200),
    }));
    return { error: 'Unexpected model answer response' };
  }

  console.log(JSON.stringify({
    event: 'fce_p2_model_answer_done',
    topic: input.topic,
    latencyMs: Date.now() - tStart,
    modelAnswerLength: parsed.model_answer.length,
  }));

  return { modelAnswer: parsed.model_answer };
}
