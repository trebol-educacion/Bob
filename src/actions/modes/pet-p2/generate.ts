'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { GenerationSchema, type PETPictureDescriptionResult } from './contracts';
import { pickRandomTopic, safeParse } from './shared';

/**
 * Generates a Picture Description task for PET B1 Part 2.
 * Creates a session when none is provided. Persists the plan as a bob message.
 */
export async function generatePETPictureDescriptionAction(input: {
  sessionId?: string;
}): Promise<PETPictureDescriptionResult | { error: string }> {
  const tStart = Date.now();
  console.log(JSON.stringify({
    event: 'pet_p2_generate_start',
    incomingSessionId: input.sessionId ?? null,
  }));

  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_pet_p2',
      title: 'Speaking Part 2 — Picture Description',
    });
    if (!result.data) {
      console.error(JSON.stringify({
        event: 'pet_p2_generate_session_failed',
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
        event: 'pet_p2_generate_no_auth',
        sessionId,
      }));
      return { error: 'Not authenticated' };
    }
    userId = user.id;
  }

  const topic = pickRandomTopic();
  console.log(JSON.stringify({
    event: 'pet_p2_topic_picked',
    sessionId,
    userId,
    topic,
  }));

  const [generationPromptText, framingText] = await Promise.all([
    getPrompt('cambridge_pet_p2_b1_generation', { TOPIC: topic }).catch(() => null),
    getPrompt('cambridge_pet_p2_b1_framing').catch(() => ''),
  ]);

  if (!generationPromptText) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_p2_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPromptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) {
    return { error: 'Could not generate scene' };
  }

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    return { error: 'Unexpected model response for generation' };
  }

  const tImgStart = Date.now();
  console.log(JSON.stringify({
    event: 'pet_p2_image_request',
    sessionId,
    scenePromptPreview: parsed.scene_prompt.slice(0, 120),
  }));
  const imageUrls = await generateYLImagesParallelAction(
    'starters',
    1,
    [parsed.scene_prompt],
    sessionId,
    undefined,
    'photo_realistic'
  );
  const imageUrl = imageUrls[0] ?? '';
  console.log(JSON.stringify({
    event: 'pet_p2_image_done',
    sessionId,
    latencyMs: Date.now() - tImgStart,
    imageReady: !!imageUrl,
    isHttpUrl: imageUrl.startsWith('https://'),
    isDataUri: imageUrl.startsWith('data:'),
  }));

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'picture_description_plan',
      topic: parsed.topic,
      framing_text: framingText,
      scene_prompt: parsed.scene_prompt,
      reference_vocabulary: parsed.reference_vocabulary,
      language_bank: parsed.language_bank,
      image_url: imageUrl,
    },
  }).catch((err) => console.warn(JSON.stringify({
    event: 'pet_p2_persist_plan_failed',
    sessionId,
    error: String(err),
  })));

  console.log(JSON.stringify({
    event: 'pet_p2_generate_done',
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
    scenePrompt: parsed.scene_prompt,
    referenceVocabulary: parsed.reference_vocabulary,
    languageBank: parsed.language_bank,
    imageUrl,
  };
}

