import { z } from 'zod';

export const KET_MATCH_PEOPLE = 5;
export const KET_MATCH_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const PersonSchema = z.object({
  number: z.number().int().min(1).max(KET_MATCH_PEOPLE),
  name: z.string().min(1),
  answer: z.enum(KET_MATCH_KEYS),
});

const OptionSchema = z.object({ key: z.enum(KET_MATCH_KEYS), text: z.string().min(1) });

const base = z.object({
  instruction: z.string().min(1),
  conversation: z.array(TurnSchema).min(6),
  people: z.array(PersonSchema).length(KET_MATCH_PEOPLE),
  options: z.array(OptionSchema).length(KET_MATCH_KEYS.length),
});

export const KetListenMatchGenSchema = base.extend({ audio_url: z.string().min(1).optional() });
export const KetListenMatchPlanSchema = base.extend({ audio_url: z.string().min(1) });

export type KetListenMatchGen = z.infer<typeof KetListenMatchGenSchema>;
export type KetListenMatchPlan = z.infer<typeof KetListenMatchPlanSchema>;
export type KetMatchKey = (typeof KET_MATCH_KEYS)[number];

export interface KetListenMatchPublic {
  instruction: string;
  people: { number: number; name: string }[];
  options: KetListenMatchPlan['options'];
  audio_url: string;
}

/**
 * @param plan full plan with keys and transcript
 * @returns plan the student sees, without answers or transcript
 */
export function toPublicListenMatch(plan: KetListenMatchPlan): KetListenMatchPublic {
  return {
    instruction: plan.instruction,
    people: plan.people.map(({ number, name }) => ({ number, name })),
    options: plan.options,
    audio_url: plan.audio_url,
  };
}
