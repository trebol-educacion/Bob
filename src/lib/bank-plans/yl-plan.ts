import { YLPlanSchema, type YLPlan, type YLExam } from '@/lib/types/yl';

export const YL_EXAM_BY_BANK: Record<YLExam, 'yle_starters' | 'yle_movers'> = {
  starters: 'yle_starters',
  movers: 'yle_movers',
};

export const YL_CEFR_BY_EXAM: Record<YLExam, string> = { starters: 'pre_a1', movers: 'a1' };

export const YlBankPlanSchema = YLPlanSchema;

type Raw = Record<string, unknown>;

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function texts(value: unknown, key: string): string[] {
  return list(value).map((entry) => String((entry as Raw)?.[key] ?? '')).filter(Boolean);
}

function pointing(p: Raw): Raw {
  return {
    cues: texts(p.cues, 'text'),
    image_prompts: list(p.option_image_prompts),
    options: list(p.options),
    option_image_prompts: list(p.option_image_prompts),
    pointing_cues: list(p.cues),
  };
}

function whatsThis(p: Raw): Raw {
  const cards = list(p.object_cards) as { image_prompt: string; questions: { text: string }[] }[];
  return {
    cues: cards.flatMap((card) => card.questions.map((q) => q.text)),
    image_prompts: cards.map((card) => card.image_prompt),
    object_cards: cards,
  };
}

function findDifferences(p: Raw): Raw {
  return {
    cues: texts(p.differences, 'examiner_cue'),
    image_prompts: [p.image_prompt_a, p.image_prompt_b],
    differences: list(p.differences),
  };
}

function tellTheStory(p: Raw): Raw {
  const scenes = list(p.scenes) as { image_prompt: string; examiner_cue?: string }[];
  return {
    cues: scenes.slice(1).map((s) => s.examiner_cue ?? ''),
    image_prompts: scenes.map((s) => s.image_prompt),
    story_setup: p.story_setup,
    scenes,
  };
}

function sceneQuestions(p: Raw): Raw {
  return { cues: list(p.questions), image_prompts: typeof p.image_prompt === 'string' ? [p.image_prompt] : [] };
}

function moversScene(p: Raw): Raw {
  const scene = [p.scene_description, p.scene_a_description].filter((v) => typeof v === 'string').join(' ');
  return { cues: texts(p.differences, 'cue'), image_prompts: scene ? [scene] : [] };
}

function personalQuestions(p: Raw): Raw {
  return { cues: list(p.questions) };
}

function storyBeats(p: Raw): Raw {
  return { cues: list(p.story_beats) };
}

const BY_PART: Record<string, (p: Raw) => Raw> = {
  starters_part1: pointing,
  starters_part2: sceneQuestions,
  starters_part3: whatsThis,
  starters_part4: personalQuestions,
  movers_part1: findDifferences,
  movers_part2: moversScene,
  movers_part3: tellTheStory,
  movers_part4: storyBeats,
};

/**
 * @param examPart starters_partN or movers_partN
 * @param raw JSON returned by the generation prompt
 * @returns plan in the shape the YL activities consume, validated against YLPlanSchema
 * @throws when the part is unknown
 */
export function normalizeYlRaw(examPart: string, raw: unknown): YLPlan {
  const build = BY_PART[examPart];
  if (!build) throw new Error(`Unknown YL part ${examPart}`);
  const p = (raw ?? {}) as Raw;
  return YLPlanSchema.parse({
    ...build(p),
    character_description: p.character_description ?? p.character ?? undefined,
    story_title: p.story_title ?? p.title ?? undefined,
  });
}

/**
 * @param examPart
 * @returns number of images the part shows, 0 when none
 */
export function expectedImages(examPart: string): number {
  return { starters_part1: 4, starters_part2: 1, starters_part3: 4, movers_part1: 2, movers_part2: 1, movers_part3: 4 }[examPart] ?? 0;
}

/**
 * @param examPart
 * @param plan
 * @returns structural issues of a plan for the part
 */
export function ylPlanIssues(examPart: string, plan: YLPlan): string[] {
  const issues: string[] = [];
  if (plan.cues.length === 0 || plan.cues.some((cue) => cue.trim().length === 0)) issues.push('cues must be non-empty');
  if (examPart === 'starters_part1') {
    const targets = (plan.pointing_cues ?? []).map((c) => c.target_index);
    if ((plan.options ?? []).length !== 4 || new Set(targets).size !== 4 || targets.some((t) => t > 3)) {
      issues.push('starters_part1 needs 4 options and 4 cues with distinct target_index 0-3');
    }
  }
  if (examPart === 'starters_part3' && (plan.object_cards ?? []).length !== 4) issues.push('starters_part3 needs 4 object cards');
  if (examPart === 'movers_part1' && (plan.differences ?? []).length !== 4) issues.push('movers_part1 needs 4 differences');
  if (examPart === 'movers_part3' && (plan.scenes ?? []).length !== 4) issues.push('movers_part3 needs 4 scenes');
  if (examPart.endsWith('part4') && plan.cues.length < 3) issues.push('part 4 needs at least 3 cues');
  if (examPart === 'starters_part2' && plan.cues.length < 3) issues.push('part 2 needs at least 3 cues');
  const wanted = expectedImages(examPart);
  if ((plan.image_prompts ?? []).length < wanted) issues.push(`${examPart} needs ${wanted} image prompts`);
  return issues;
}
