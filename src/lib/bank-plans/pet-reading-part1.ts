import { z } from 'zod';

const OptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  text: z.string().min(1),
});

const ShortTextItemSchema = z.object({
  number: z.number().int().min(1).max(5),
  text_body: z.string().min(1),
  text_context: z.string().min(1),
  question: z.string().min(1),
  options: z.array(OptionSchema).length(3),
  correct_option: z.enum(['A', 'B', 'C']),
  explanation: z.string().min(1),
});

export const PetShortTextsPlanSchema = z.object({
  items: z.array(ShortTextItemSchema).length(5),
});

export type PetShortTextsPlan = z.infer<typeof PetShortTextsPlanSchema>;
