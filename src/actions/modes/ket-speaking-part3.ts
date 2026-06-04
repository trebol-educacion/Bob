'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { MODELS } from '@/lib/models';

const GenerationSchema = z.object({
  scene_description: z.string(),
  instruction: z.string(),
  image_prompt: z.string(),
});

const EvaluationSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().nullable().optional(),
});

export interface PictureDescPrompt {
  sessionId: string;
  userId: string;
  scene_description: string;
  instruction: string;
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  image_url: string;
}

export interface PictureDescFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

function fallbackFeedback(): PictureDescFeedback {
  return { understood: false, highlights: [], suggestions: ['Try again — we could not process your response.'], model_answer: null };
}

export async function generateKETPictureDescAction(input: {
  sessionId?: string;
}): Promise<PictureDescPrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_part3', title: 'KET Speaking Part 3 — Describe the Picture' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const generationPrompt = await getPrompt('cambridge_ket_part3_a2_generation').catch(() => null);
  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_part3_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
      config: { responseMimeType: 'application/json' },
    })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 3, [parsed.image_prompt], sessionId!, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(parsed.instruction).catch(() => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })),
  ]);

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'picture_desc_prompt', scene_description: parsed.scene_description, instruction: parsed.instruction, image_url: imageUrls[0] ?? '' },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    scene_description: parsed.scene_description,
    instruction: parsed.instruction,
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    image_url: imageUrls[0] ?? '',
  };
}

export async function evaluateKETPictureDescAction(input: {
  sessionId: string;
  userId: string;
  audioBase64: string;
  audioMime: string;
  scene_description: string;
}): Promise<PictureDescFeedback | { error: string }> {
  const evalPromptTemplate = await getPrompt('cambridge_ket_part3_a2_evaluation').catch(() => null);
  if (!evalPromptTemplate) return fallbackFeedback();

  const prompt = evalPromptTemplate
    .replace('{SCENE_DESCRIPTION}', input.scene_description)
    .replace('{TRANSCRIPT}', '[audio attached]');

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_part3_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: input.audioMime, data: input.audioBase64 } },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    })
  );

  if (!isOk(geminiResult)) return fallbackFeedback();

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(EvaluationSchema, rawText);
  if (!parsed) return fallbackFeedback();

  const feedback: PictureDescFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer ?? null,
  };

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'picture_desc_feedback', ...feedback, is_final: true },
  }).catch(() => undefined);

  return feedback;
}
