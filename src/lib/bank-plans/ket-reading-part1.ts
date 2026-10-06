import { z } from 'zod';

const OptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  text: z.string().min(1),
});

const SignItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  sign_text: z.string().min(1),
  sign_context: z.string().min(1),
  question: z.string().min(1),
  options: z.array(OptionSchema).length(3),
  correct_option: z.enum(['A', 'B', 'C']),
  explanation: z.string().min(1),
  sign_style: z.enum(['prohibition', 'warning', 'info', 'shop', 'default']).optional(),
  image_url: z.string().optional(),
});

export const KetSignsPlanSchema = z.object({
  items: z.array(SignItemSchema).length(6),
});

export type KetSignItem = z.infer<typeof SignItemSchema>;
export type KetSignsPlan = z.infer<typeof KetSignsPlanSchema>;
