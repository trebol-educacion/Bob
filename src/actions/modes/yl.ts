'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { EvalResponseSchema, type EvalResponse, type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan, type YLExam, type YLTurnEvalResult } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import {
  buildDirectImagenPrompt,
  generateImageWithFallback,
  YL_IMAGE_PLACEHOLDER,
} from '@/lib/yl-imagen';

/** Map a ModeKey to exam + part number. */
function parseYLMode(mode: ModeKey): { exam: YLExam; part: number } {
  const match = mode.match(/^cambridge_(starters|movers)_part(\d+)$/);
  if (!match) {
    console.error(JSON.stringify({ event: 'parseYLMode', error: `Unrecognised YL mode key: ${mode}` }));
    return { exam: 'starters', part: 1 };
  }
  return { exam: match[1] as YLExam, part: Number(match[2]) };
}

/** Build the generation prompt key for a given exam+part. */
function generationKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_generation`;
}

/** Build the evaluation prompt key. */
function evaluationKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_evaluation`;
}

/** Build the examiner reaction prompt key. */
function reactionKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_examiner_reaction`;
}

/** Build the image_gen prompt key. */
function imageGenKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_image_gen`;
}

const YLPlanFallback: YLPlan = {
  cues: ['Point to something red.', 'Point to something big.', 'Point to a cat.', 'Point to a house.'],
  image_prompts: ['A colourful room with many objects including red and big items, a cat, and a house.'],
};

const EvalFallback: EvalResponse = {
  score: 5,
  score_max: 15,
  cefr_band: 'a1',
  feedback: 'Nice try! Keep practising.',
};


export async function startYLSessionAction(input: {
  mode: ModeKey;
}): Promise<{ sessionId: string; plan: YLPlan }> {
  const { exam, part } = parseYLMode(input.mode);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'startYLSessionAction', error: 'Not authenticated' }));
    return { sessionId: '', plan: YLPlanFallback };
  }

  const partTitles: Record<string, string> = {
    starters_1: 'Starters Part 1 — Listen and Point',
    starters_2: 'Starters Part 2 — Look and Answer',
    starters_3: 'Starters Part 3 — What\'s This?',
    starters_4: 'Starters Part 4 — Personal Questions',
    movers_1: 'Movers Part 1 — Find the Differences',
    movers_2: 'Movers Part 2 — Information Exchange',
    movers_3: 'Movers Part 3 — Tell the Story',
    movers_4: 'Movers Part 4 — Personal Questions',
    movers_5: 'Movers Part 5 — More About You',
  };
  const titleKey = `${exam}_${part}`;
  const title = partTitles[titleKey] ?? `Cambridge ${exam} Part ${part}`;

  const t0 = Date.now();
  const { data: session, error: sessionErr } = await supabase
    .from('bob_sessions')
    .insert({
      user_id: user.id,
      mode: input.mode,
      topic: `${exam}_part${part}`,
      title,
    })
    .select()
    .single();

  if (sessionErr || !session) {
    console.error(JSON.stringify({ event: 'startYLSessionAction', error: sessionErr?.message ?? 'no session' }));
    return { sessionId: '', plan: YLPlanFallback };
  }

  const { data: recent } = await supabase
    .from('bob_sessions')
    .select('plan_json')
    .eq('user_id', user.id)
    .eq('mode', input.mode)
    .not('plan_json', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const avoidSummary = (recent ?? [])
    .map((r) => {
      const p = r.plan_json as { options?: string[]; cues?: unknown[] } | null;
      if (!p) return null;
      if (p.options && p.options.length > 0) return `[${p.options.join(', ')}]`;
      if (p.cues && p.cues.length > 0)
        return `[${(p.cues as Array<string | { text?: string }>).map((c) => (typeof c === 'string' ? c : c.text ?? '')).slice(0, 3).join(' | ')}…]`;
      return null;
    })
    .filter((s): s is string => s !== null)
    .join('\n- ');

  const avoidList = avoidSummary ? `- ${avoidSummary}` : '(none yet — feel free to pick any topic)';

  const t1 = Date.now();
  const plan = await generateYLContentAction(exam, part, { avoidList });
  console.log(`[YL][${input.mode}] plan ready in ${Date.now() - t1}ms (cues=${plan.cues?.length ?? 0}, images=${plan.image_prompts?.length ?? 0})`);

  await supabase.from('bob_sessions').update({ plan_json: plan }).eq('id', session.id);

  return { sessionId: session.id as string, plan };
}

/**
 * Persist a single scene image. Called once per image from the client to
 * stay well under the Next server-action body limit and the array-nesting
 * cap. Idempotent over (session, image_index) thanks to the index check.
 */
export async function persistYLImageAction(
  sessionId: string,
  imageDataUri: string,
  imageIndex: number
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'persistYLImageAction', error: 'Not authenticated' }));
    return;
  }

  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'image_scene',
    contentText: null,
    contentJson: { image_data_uri: imageDataUri, image_index: imageIndex },
  });
}

/** Deprecated: kept for backwards compatibility — iterates one image at a time. */
export async function persistYLImagesAction(
  sessionId: string,
  imageDataUris: string[]
): Promise<void> {
  for (let i = 0; i < imageDataUris.length; i++) {
    await persistYLImageAction(sessionId, imageDataUris[i], i);
  }
}

/**
 * Persist a client-computed final evaluation (used by Pointing-style
 * activities where the score is derived from click-accuracy rather than
 * via Gemini). Saves the same `msg_type='evaluation'` row shape used by
 * evaluateYLFinalAction so reopen logic finds it identically.
 */
export async function saveYLFinalEvalAction(
  sessionId: string,
  evalResult: EvalResponse
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'saveYLFinalEvalAction', error: 'Not authenticated' }));
    return;
  }
  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: { ...evalResult, is_final: true },
  });
}

import { generateSpeechAction } from '@/actions/gemini';

export async function getOrCreateCueAudioAction(
  sessionId: string,
  cueText: string
): Promise<{ data: string; mimeType: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'getOrCreateCueAudioAction', error: 'Not authenticated' }));
    return { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };
  }

  const { data: existing } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('session_id', sessionId)
    .eq('msg_type', 'yl_tts')
    .eq('content_text', cueText)
    .limit(1)
    .maybeSingle();

  if (existing?.content_json) {
    const cached = existing.content_json as { audio_b64?: string; mime?: string };
    if (cached.audio_b64) {
      return { data: cached.audio_b64, mimeType: cached.mime ?? 'audio/L16;codec=pcm;rate=24000' };
    }
  }

  const { data, mimeType } = await generateSpeechAction(cueText);

  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'yl_tts',
    contentText: cueText,
    contentJson: { audio_b64: data, mime: mimeType },
  });

  return { data, mimeType };
}

export async function pregenerateYLCueAudiosAction(
  sessionId: string,
  cues: string[],
): Promise<void> {
  await Promise.all(
    cues.map(async (cue) => {
      try {
        await getOrCreateCueAudioAction(sessionId, cue);
      } catch (err) {
        console.warn('[YL] pregenerate cue audio failed (non-fatal):', err);
      }
    }),
  );
}

export async function generateYLContentAction(
  exam: YLExam,
  part: number,
  options?: { avoidList?: string }
): Promise<YLPlan> {
  const avoidList = options?.avoidList ?? '(none)';

  const isPointingMode = exam === 'starters' && part === 1;
  const isWhatsThisMode = exam === 'starters' && part === 3;
  const isFindDifferencesMode = exam === 'movers' && part === 1;
  const isTellTheStoryMode = exam === 'movers' && part === 3;
  const needsPreselectedWords = isPointingMode || isWhatsThisMode || isFindDifferencesMode || isTellTheStoryMode;

  const preselectedWords = needsPreselectedWords
    ? await pickVocabularyForActivity({
        framework: 'cambridge',
        cefr_level: isPointingMode || isWhatsThisMode ? 'pre_a1' : 'a1',
        count: isTellTheStoryMode ? 3 : 4,
        distinctCategories: true,
        objectCardFriendlyOnly: isWhatsThisMode,
      })
    : [];

  const promptVariables: Record<string, string> = {
    AVOID_LIST: avoidList,
  };
  if (isTellTheStoryMode && preselectedWords.length === 3) {
    promptVariables.WORD_1 = preselectedWords[0].word;
    promptVariables.WORD_2 = preselectedWords[1].word;
    promptVariables.WORD_3 = preselectedWords[2].word;
  } else if (preselectedWords.length === 4) {
    promptVariables.WORD_1 = preselectedWords[0].word;
    promptVariables.WORD_2 = preselectedWords[1].word;
    promptVariables.WORD_3 = preselectedWords[2].word;
    promptVariables.WORD_4 = preselectedWords[3].word;
  }

  const cacheInputs: Record<string, unknown> = { avoidList };
  if (isTellTheStoryMode && preselectedWords.length === 3) {
    cacheInputs.words = preselectedWords.map((w) => w.word).join(',');
  } else if (preselectedWords.length === 4) {
    cacheInputs.words = preselectedWords.map((w) => w.word).join(',');
  }

  const cached = await getOrCreateCachedContent<YLPlan>(
    { kind: 'plan', promptKey: `yl-content-${exam}-part${part}`, inputs: cacheInputs },
    async () => {
      const promptText = await getPrompt(generationKey(exam, part), promptVariables);

      const result = await callGemini(
        { promptKey: generationKey(exam, part), model: MODELS.FLASH_LITE_PREVIEW },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: { responseMimeType: 'application/json' },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generateYLContentAction', error: result.ok ? 'empty response' : result.error }));
        return YLPlanFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        console.error(JSON.stringify({ event: 'generateYLContentAction', error: 'invalid JSON' }));
        return YLPlanFallback;
      }

      const p = (parsed ?? {}) as Record<string, unknown>;

      const isPointing =
        Array.isArray(p.options) &&
        Array.isArray(p.option_image_prompts) &&
        Array.isArray(p.cues) &&
        p.cues.length > 0 &&
        typeof (p.cues as unknown[])[0] === 'object';

      const isWhatsThis = Array.isArray(p.object_cards) && (p.object_cards as unknown[]).length > 0;

      const isFindDiffs =
        Array.isArray(p.differences) &&
        (p.differences as unknown[]).length > 0 &&
        typeof p.image_prompt_a === 'string' &&
        typeof p.image_prompt_b === 'string';

      const isTellTheStory =
        Array.isArray(p.scenes) &&
        (p.scenes as unknown[]).length === 4 &&
        typeof p.story_title === 'string';

      const normalized: Record<string, unknown> = {
        cues: isPointing
          ? (p.cues as Array<{ text: string }>).map((c) => c.text)
          : isWhatsThis
          ? (p.object_cards as Array<{ questions: Array<{ text: string }> }>).flatMap((card) =>
              card.questions.map((q) => q.text)
            )
          : isFindDiffs
          ? (p.differences as Array<{ examiner_cue: string }>).map((d) => d.examiner_cue)
          : isTellTheStory
          ? (p.scenes as Array<{ examiner_cue?: string }>)
              .slice(1)
              .map((s) => s.examiner_cue ?? '')
          : (p.cues as unknown[]) ??
            (p.examiner_cues as unknown[]) ??
            (p.target_questions as unknown[]) ??
            (typeof p.scene_description === 'string' ? [p.scene_description] : []),
        image_prompts: isPointing
          ? (p.option_image_prompts as unknown[])
          : isWhatsThis
          ? (p.object_cards as Array<{ image_prompt: string }>).map((c) => c.image_prompt)
          : isFindDiffs
          ? [p.image_prompt_a, p.image_prompt_b]
          : isTellTheStory
          ? (p.scenes as Array<{ image_prompt: string }>).map((s) => s.image_prompt)
          : (p.image_prompts as unknown[]) ??
            (typeof p.image_prompt === 'string' ? [p.image_prompt] : undefined),
        character_description: p.character_description ?? p.character ?? undefined,
        story_title: p.story_title ?? p.title ?? undefined,
        story_setup: isTellTheStory ? (p.story_setup as string | undefined) : undefined,
        scenes: isTellTheStory ? (p.scenes as unknown[]) : undefined,
        story_beats: (p.story_beats as unknown[]) ?? (p.beats as unknown[]) ?? undefined,
        student_card: p.student_card ?? undefined,
        examiner_card: p.examiner_card ?? undefined,
        target_questions: (p.target_questions as unknown[]) ?? undefined,
        options: isPointing ? (p.options as unknown[]) : undefined,
        option_image_prompts: isPointing ? (p.option_image_prompts as unknown[]) : undefined,
        pointing_cues: isPointing ? (p.cues as unknown[]) : undefined,
        object_cards: isWhatsThis ? (p.object_cards as unknown[]) : undefined,
        differences: isFindDiffs ? (p.differences as unknown[]) : undefined,
      };

      return safeParseFallback(YLPlanSchema, normalized, YLPlanFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateYLContentAction_cache', error: cached.error }));
    return YLPlanFallback;
  }

  if (isPointingMode && cached.pointing_cues && cached.pointing_cues.length > 1) {
    const shuffled = [...cached.pointing_cues].sort(() => Math.random() - 0.5);
    const cuesAsText = shuffled.map((c) => c.text);
    return { ...cached, pointing_cues: shuffled, cues: cuesAsText };
  }

  if (isWhatsThisMode && cached.object_cards && cached.object_cards.length > 1) {
    const shuffled = [...cached.object_cards].sort(() => Math.random() - 0.5);
    const cuesAsText = shuffled.flatMap((card) => card.questions.map((q) => q.text));
    return { ...cached, object_cards: shuffled, cues: cuesAsText };
  }

  if (isFindDifferencesMode && cached.differences && cached.differences.length > 1) {
    const shuffled = [...cached.differences].sort(() => Math.random() - 0.5);
    const cuesAsText = shuffled.map((d) => d.examiner_cue);
    return { ...cached, differences: shuffled, cues: cuesAsText };
  }

  return cached;
}

/**
 * Generate a single YL image. Called one-at-a-time from the client to
 * avoid Next.js server-action "Maximum array nesting" when several large
 * base64 strings travel together. Iterate at the call site, not here.
 */
export async function generateYLImageAction(
  exam: YLExam,
  part: number,
  imagePrompt: string,
  idx: number,
  totalImages: number,
  sessionId: string,
  characterDescription?: string
): Promise<string> {
  const cacheInputs: Record<string, unknown> = { exam, part, imagePrompt };
  if (characterDescription) cacheInputs.characterDescription = characterDescription;

  const cached = await getOrCreateCachedContent<string>(
    { kind: 'image', promptKey: `yl-image-${exam}-part${part}`, inputs: cacheInputs },
    async () => {
      const key = imageGenKey(exam, part);
      const imagenPrompt = buildDirectImagenPrompt(imagePrompt, characterDescription);
      const pixels = await generateImageWithFallback(key, imagenPrompt);

      if (!pixels) {
        throw new Error('empty image after all attempts');
      }

      const { b64: imgB64, mime } = pixels;

      const supabase = await createSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error(JSON.stringify({ event: 'generateYLImageAction', error: 'Not authenticated for storage upload' }));
        return `data:${mime};base64,${imgB64}`;
      }

      const ext = mime.includes('jpeg') ? 'jpg' : 'png';
      const path = `${user.id}/${sessionId}/${idx}.${ext}`;
      const bytes = Buffer.from(imgB64, 'base64');
      const upload = await supabase.storage
        .from('bob-images')
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (upload.error) {
        console.error('[generateYLImageAction] storage upload failed:', upload.error);
        return `data:${mime};base64,${imgB64}`;
      }

      const { data: pub } = supabase.storage.from('bob-images').getPublicUrl(path);
      return pub.publicUrl;
    },
    { storeAs: 'blob', validate: (url) => typeof url === 'string' && url.startsWith('https://') }
  );

  if (typeof cached === 'object' && 'error' in cached) {
    return YL_IMAGE_PLACEHOLDER;
  }
  return cached as string;
}

/**
 * Parallel batch variant. One Server Action call → `Promise.all` of N
 * generations + Supabase Storage uploads on the server. Returns URLs only,
 * so payload stays tiny. Bypasses Next.js Server Action client queue, which
 * would otherwise serialise N separate `generateYLImageAction` calls.
 *
 * Accepts both shapes for backwards compatibility:
 *   - `string[]` (legacy)  → no word-image pool reuse, always generates.
 *   - `Array<{word, scenePrompt}>` → checks bob_word_images pool first
 *     (70% probability of reuse if pool has entries for that word).
 */
export async function generateYLImagesParallelAction(
  exam: YLExam,
  part: number,
  imagePrompts: string[] | Array<{ word: string; scenePrompt: string }>,
  sessionId: string,
  characterDescription?: string,
  imageType: YLImageType = 'scene'
): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const items: Array<{ word?: string; scenePrompt: string }> = imagePrompts.map((p) =>
    typeof p === 'string' ? { scenePrompt: p } : p
  );

  return Promise.all(
    items.map(async (item, idx) => {
      if (item.word) {
        const fromPool = await tryPickFromImagePool({
          framework: 'cambridge',
          cefr_level: 'pre_a1',
          word: item.word,
          image_type: imageType,
        });
        if (fromPool) return fromPool;
      }

      const effectiveCharacter = imageType === 'object_card' ? undefined : characterDescription;
      const cacheInputs: Record<string, unknown> = { exam, part, imagePrompt: item.scenePrompt, imageType };
      if (effectiveCharacter) cacheInputs.characterDescription = effectiveCharacter;

      const cached = await getOrCreateCachedContent<string>(
        { kind: 'image', promptKey: `yl-image-${exam}-part${part}`, inputs: cacheInputs },
        async () => {
          const key = imageGenKey(exam, part);
          const imagenPrompt = buildDirectImagenPrompt(item.scenePrompt, effectiveCharacter, imageType);
          const pixels = await generateImageWithFallback(key, imagenPrompt);
          if (!pixels) throw new Error('empty image after all attempts');

          const { b64: imgB64, mime } = pixels;
          if (!user) return `data:${mime};base64,${imgB64}`;

          const ext = mime.includes('jpeg') ? 'jpg' : 'png';
          const path = `${user.id}/${sessionId}/${idx}.${ext}`;
          const bytes = Buffer.from(imgB64, 'base64');
          const upload = await supabase.storage
            .from('bob-images')
            .upload(path, bytes, { contentType: mime, upsert: true });
          if (upload.error) {
            console.error('[generateYLImagesParallelAction] storage upload failed:', upload.error);
            return `data:${mime};base64,${imgB64}`;
          }
          const { data: pub } = supabase.storage.from('bob-images').getPublicUrl(path);
          return pub.publicUrl;
        },
        { storeAs: 'blob', validate: (url) => typeof url === 'string' && url.startsWith('https://') }
      );

      if (typeof cached === 'object' && 'error' in cached) return YL_IMAGE_PLACEHOLDER;

      const url = cached as string;
      if (item.word && url.startsWith('https://')) {
        void addImageToPool({
          framework: 'cambridge',
          cefr_level: 'pre_a1',
          word: item.word,
          image_url: url,
          scene_prompt: item.scenePrompt,
          image_type: imageType,
        });
      }
      return url;
    })
  );
}

/**
 * @deprecated batched variant — kept temporarily for callers that still
 * pass an array. Internally fans out to generateYLImageAction one at a
 * time on the SERVER, but the response (array of 4 base64) is still huge
 * and breaks Next's array nesting. Prefer calling generateYLImageAction
 * directly from the client in a loop.
 */
export async function generateYLImagesAction(
  exam: YLExam,
  part: number,
  imagePrompts: string[],
  characterDescription?: string,
  sessionId?: string,
): Promise<string[]> {
  const key = imageGenKey(exam, part);

  console.log(`[YL][${exam}_part${part}] generating ${imagePrompts.length} image(s)`);
  const t0 = Date.now();

  const images = await Promise.all(
    imagePrompts.map(async (imagePrompt, idx) => {
      const imagenPrompt = buildDirectImagenPrompt(imagePrompt, characterDescription);
      const pixels = await generateImageWithFallback(key, imagenPrompt);
      if (pixels) {
        console.log(
          `[YL][${exam}_part${part}] image ${idx + 1} ok in ${Date.now() - t0}ms (total elapsed)`
        );
        return `data:${pixels.mime};base64,${pixels.b64}`;
      }
      console.warn(`[generateYLImagesAction] empty image ${idx + 1}; scene:`, imagePrompt.slice(0, 120));
      return YL_IMAGE_PLACEHOLDER;
    })
  );

  if (sessionId) {
    for (let i = 0; i < images.length; i++) {
      try {
        await persistYLImageAction(sessionId, images[i], i);
      } catch (err) {
        console.warn(`[YL][${exam}_part${part}] persist image ${i} failed (non-fatal):`, err);
      }
    }
  }

  return images;
}

export async function saveYLTurnAction(
  sessionId: string,
  turn: {
    cue: string;
    cueIndex: number;
    transcript: string;
    reaction: string;
    score?: number;
    evalResult?: EvalResponse;
  }
): Promise<void> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error(JSON.stringify({ event: 'saveYLTurnAction', error: 'Not authenticated' }));
    return;
  }

  const result = await persistMessages([
    {
      sessionId,
      userId: user.id,
      role: 'user',
      msgType: 'user_audio',
      contentText: turn.transcript,
      contentJson: {
        cue: turn.cue,
        cue_index: turn.cueIndex,
        transcribed: turn.transcript,
      },
    },
    {
      sessionId,
      userId: user.id,
      role: 'bob',
      msgType: 'yl_cue',
      contentText: turn.reaction,
      contentJson: {
        reaction: turn.reaction,
        cue_index: turn.cueIndex,
        ...(turn.evalResult ? { eval: turn.evalResult } : {}),
      },
    },
  ]);

  if ('error' in result) {
    console.error(JSON.stringify({ event: 'saveYLTurnAction', error: result.error }));
  }
}

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
        config: { responseMimeType: 'application/json' },
      })
    ),
    callGemini(
      { promptKey: reactionKey(exam, part), model: MODELS.FLASH_LITE_PREVIEW },
      (ai) => ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: reactionPrompt }] }],
        config: { responseMimeType: 'application/json' },
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
      config: { responseMimeType: 'application/json' },
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

import { getMessagesAction } from '@/actions/messages';
import type { FindDifference } from '@/lib/types/yl';

export async function getSessionMessagesAction(sessionId: string) {
  return getMessagesAction(sessionId);
}

export async function getYLSessionPlanAction(sessionId: string): Promise<YLPlan | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('bob_sessions')
    .select('plan_json')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data || !data.plan_json) return null;
  return safeParseFallback(YLPlanSchema, data.plan_json, YLPlanFallback);
}

const POOL_REUSE_PROBABILITY = 0.7;

type VocabPick = { word: string; category: string };

async function pickVocabularyForActivity(opts: {
  framework: string;
  cefr_level: string;
  count: number;
  distinctCategories?: boolean;
  objectCardFriendlyOnly?: boolean;
}): Promise<VocabPick[]> {
  const { framework, cefr_level, count, distinctCategories = true, objectCardFriendlyOnly = false } = opts;
  const supabase = await createSupabaseServer();
  let query = supabase
    .from('bob_vocabulary')
    .select('word, category')
    .eq('framework', framework)
    .eq('cefr_level', cefr_level)
    .eq('pointable', true);
  if (objectCardFriendlyOnly) {
    query = query.eq('object_card_friendly', true);
  }
  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    console.warn('[pickVocabularyForActivity] empty vocab pool', { framework, cefr_level, error });
    return [];
  }

  const rows = data as VocabPick[];
  const shuffled = [...rows].sort(() => Math.random() - 0.5);

  if (!distinctCategories) {
    return shuffled.slice(0, count);
  }

  const picked: VocabPick[] = [];
  const usedCategories = new Set<string>();
  for (const row of shuffled) {
    if (picked.length === count) break;
    if (usedCategories.has(row.category)) continue;
    picked.push(row);
    usedCategories.add(row.category);
  }
  for (const row of shuffled) {
    if (picked.length === count) break;
    if (picked.includes(row)) continue;
    picked.push(row);
  }
  return picked;
}

export type YLImageType = 'scene' | 'object_card' | 'photo_realistic';

async function tryPickFromImagePool(opts: {
  framework: string;
  cefr_level: string;
  word: string;
  image_type: YLImageType;
}): Promise<string | null> {
  if (Math.random() >= POOL_REUSE_PROBABILITY) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('bob_word_images')
    .select('id, image_url')
    .eq('framework', opts.framework)
    .eq('cefr_level', opts.cefr_level)
    .eq('word', opts.word)
    .eq('image_type', opts.image_type)
    .limit(50);
  const rows = (data ?? []) as Array<{ id: number; image_url: string }>;
  if (rows.length === 0) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)];
  void supabase
    .from('bob_word_images')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', pick.id)
    .then(() => undefined, () => undefined);
  return pick.image_url;
}

async function addImageToPool(opts: {
  framework: string;
  cefr_level: string;
  word: string;
  image_url: string;
  scene_prompt: string;
  image_type: YLImageType;
}): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase
    .from('bob_word_images')
    .insert({
      framework: opts.framework,
      cefr_level: opts.cefr_level,
      word: opts.word,
      image_url: opts.image_url,
      scene_prompt: opts.scene_prompt,
      image_type: opts.image_type,
    })
    .then(() => undefined, (err) => console.warn('[addImageToPool] insert failed', err));
}

const WhatsThisEvalResultSchema = z.object({
  score: z.number().int().min(0).max(1),
  score_max: z.number().int().default(1),
  cefr_band: z.string().default('a1'),
  correct: z.boolean(),
  reaction: z.string(),
  feedback: z.string().optional(),
  transcript_used: z.string().optional(),
});

export type WhatsThisEvalResult = z.infer<typeof WhatsThisEvalResultSchema> & {
  transcript: string;
};

const WhatsThisEvalFallback: WhatsThisEvalResult = {
  score: 0,
  score_max: 1,
  cefr_band: 'a1',
  correct: false,
  reaction: "Good try! Let's keep going!",
  feedback: undefined,
  transcript_used: undefined,
  transcript: '',
};

/**
 * Evaluates a single spoken answer for the Starters Part 3 "What's This?" activity.
 * Transcribes the audio, evaluates against the expected answer, generates a warm
 * reaction, and persists the turn via saveYLTurnAction.
 */
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
      config: { responseMimeType: 'application/json' },
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

/**
 * Evaluates a single spoken answer for the Movers Part 1 "Find the Differences" activity.
 * Transcribes the audio, evaluates binary correctness, generates a warm reaction,
 * and persists the turn via saveYLTurnAction.
 */
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
      config: { responseMimeType: 'application/json' },
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

/**
 * Evaluates a single spoken scene narration for Movers Part 3 "Tell the Story".
 * Transcribes the audio, evaluates keyword presence, generates a warm reaction,
 * and persists the turn via saveYLTurnAction.
 */
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
      config: { responseMimeType: 'application/json' },
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
