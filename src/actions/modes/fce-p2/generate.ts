'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { GenerationSchema, type FCELongTurnResult } from './contracts';
import { pickRandomTopic, safeParse } from './shared';

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

