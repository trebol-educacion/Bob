import { z } from 'zod';

const GapSchema = z.object({
  number: z.number().int().min(1).max(5),
  label: z.string().min(1),
  answer: z.string().min(1),
});

const base = z.object({
  context: z.string().min(1),
  form_title: z.string().min(1),
  transcript: z.string().min(1),
  gaps: z.array(GapSchema).length(5),
});

export const KetListenCompleteGenSchema = base.extend({ audio_url: z.string().min(1).optional() });
export const KetListenCompletePlanSchema = base.extend({ audio_url: z.string().min(1) });

export type KetListenCompleteGen = z.infer<typeof KetListenCompleteGenSchema>;
export type KetListenCompletePlan = z.infer<typeof KetListenCompletePlanSchema>;
