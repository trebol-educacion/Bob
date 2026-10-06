import { z } from 'zod';
import { expectedImages, normalizeYlRaw, ylPlanIssues, YL_CEFR_BY_EXAM, YL_EXAM_BY_BANK } from '../../../src/lib/bank-plans/yl-plan';
import { buildDirectImagenPrompt } from '../../../src/lib/yl-image-prompt';
import { spokenTexts } from '../../../src/lib/yl/spoken-texts';
import { YLPlanSchema, type YLExam, type YLPlan } from '../../../src/lib/types/yl';
import { assetPath, drawImage, inBatches, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { duplicateIssues } from '../rules';
import { definePart, type PlanPart, type ProduceEnv, type SlotContext } from '../types';
import { vocabularyMessage, WORDS_BY_PART } from './yl-words';

const VOICE = [{ name: 'Speaker', voice: 'Sadaltager' }];
const OBJECT_CARD_PARTS = new Set(['starters_part3']);

function RawSchema(examPart: string) {
  return z.unknown().transform((raw, ctx) => {
    try {
      return normalizeYlRaw(examPart, raw);
    } catch (err) {
      ctx.addIssue({ code: 'custom', message: err instanceof Error ? err.message : 'invalid raw plan' });
      return z.NEVER;
    }
  });
}

async function drawAll(plan: YLPlan, env: ProduceEnv, examPart: string): Promise<string[]> {
  const prompts = (plan.image_prompts ?? []).slice(0, expectedImages(examPart));
  const type = OBJECT_CARD_PARTS.has(examPart) ? 'object_card' : 'scene';
  return inBatches(
    prompts.map((scene, index) => () =>
      drawImage(
        env.ai,
        env.db,
        assetPath(examPart, env.variant, `${index + 1}.jpg`),
        buildDirectImagenPrompt(scene, plan.character_description, type),
      ),
    ),
    4,
  );
}

async function speakAll(plan: YLPlan, env: ProduceEnv, examPart: string): Promise<Record<string, string>> {
  const texts = spokenTexts(examPart, plan);
  const urls = await inBatches(
    texts.map((text, index) => () => speak(env.ai, env.db, assetPath(examPart, env.variant, `a${index + 1}.mp3`), text, VOICE)),
    3,
  );
  return Object.fromEntries(texts.map((text, index) => [text, urls[index]]));
}

function ylPart(exam: YLExam, number: number): PlanPart {
  const examPart = `${exam}_part${number}`;
  const words = WORDS_BY_PART[examPart];
  return definePart<YLPlan>({
    exam: YL_EXAM_BY_BANK[exam],
    cefr: YL_CEFR_BY_EXAM[exam],
    skill: 'speaking',
    examPart,
    promptKey: `cambridge_${examPart}_a1_generation`,
    short: `yl-${exam[0]}${number}`,
    schema: RawSchema(examPart) as unknown as z.ZodType<YLPlan>,
    message: words ? (prompt: string, ctx: SlotContext) => vocabularyMessage(prompt, ctx, words) : undefined,
    normalize: stripAllDashes,
    rules: (plan) => [
      ...ylPlanIssues(examPart, plan),
      ...duplicateIssues(plan.cues, 'cue'),
      ...(YLPlanSchema.safeParse(plan).success ? [] : ['plan does not match YLPlanSchema']),
    ],
    produce: async (plan, env) => {
      const image_urls = await drawAll(plan, env, examPart);
      const audio_urls = await speakAll(plan, env, examPart);
      return { ...plan, image_urls, audio_urls };
    },
    labelOf: (plan) => plan.options?.join(', ') ?? plan.story_title ?? plan.object_cards?.map((c) => c.word).join(', ') ?? plan.cues[0] ?? '',
  });
}

export const YL_PARTS: PlanPart[] = [
  ylPart('starters', 1),
  ylPart('starters', 2),
  ylPart('starters', 3),
  ylPart('starters', 4),
  ylPart('movers', 1),
  ylPart('movers', 2),
  ylPart('movers', 3),
  ylPart('movers', 4),
];
