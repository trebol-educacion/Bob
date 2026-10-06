import { z } from 'zod';

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const StatementSchema = z.object({
  number: z.number().int().min(1).max(5),
  text: z.string().min(1),
  verdict: z.enum(['T', 'F', 'DS']),
});

const base = z.object({
  context: z.string().min(1),
  audio: z.array(TurnSchema).min(1),
  statements: z.array(StatementSchema).length(5),
});

export const KetTfdsGenSchema = base.extend({ audio_url: z.string().min(1).optional() });
export const KetTfdsPlanSchema = base.extend({ audio_url: z.string().min(1) });

export type KetTfdsGen = z.infer<typeof KetTfdsGenSchema>;
export type KetTfdsPlan = z.infer<typeof KetTfdsPlanSchema>;
