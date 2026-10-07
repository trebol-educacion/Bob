import { z } from 'zod';

export const KET_OPEN_CLOZE_GAPS = 6;

const GapSchema = z.object({
  number: z.number().int().min(1).max(KET_OPEN_CLOZE_GAPS),
  answer: z.string().min(1),
  accepted: z.array(z.string().min(1)).default([]),
});

export const KetOpenClozePlanSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  gaps: z.array(GapSchema).length(KET_OPEN_CLOZE_GAPS),
});

export type KetOpenClozeGap = z.infer<typeof GapSchema>;
export type KetOpenClozePlan = z.infer<typeof KetOpenClozePlanSchema>;

export interface KetOpenClozePublic {
  title: string;
  text: string;
  gap_numbers: number[];
}

/**
 * @param plan full plan with keys
 * @returns plan the student sees, without answers
 */
export function toPublicOpenCloze(plan: KetOpenClozePlan): KetOpenClozePublic {
  return { title: plan.title, text: plan.text, gap_numbers: plan.gaps.map((gap) => gap.number) };
}
