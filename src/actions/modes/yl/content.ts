'use server';

import { MODELS } from '@/lib/models';
import { YLPlanSchema, type YLPlan, type YLExam } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { generationKey, YLPlanFallback } from './_helpers';

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
    .from('vocabulary')
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
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
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
