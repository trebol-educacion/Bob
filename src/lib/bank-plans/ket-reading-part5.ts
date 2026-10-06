import { z } from 'zod';

export const VERDICTS = ['T', 'F', 'DS'] as const;

const StatementSchema = z.object({
  number: z.number().int().min(1).max(6),
  text: z.string().min(1),
  verdict: z.enum(VERDICTS),
});

export const KetTfdsPlanSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  statements: z.array(StatementSchema).length(6),
});

export type KetStatement = z.infer<typeof StatementSchema>;
export type KetTfdsPlan = z.infer<typeof KetTfdsPlanSchema>;
