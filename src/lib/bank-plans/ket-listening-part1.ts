import { z } from 'zod';

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const OptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  description: z.string().min(1),
  image_prompt: z.string().min(1),
  image_url: z.string().min(1).optional(),
});

const ItemSchema = z.object({
  number: z.number().int().min(1).max(5),
  context: z.string().min(1),
  dialogue: z.array(TurnSchema).min(2).max(4),
  question: z.string().min(1),
  options: z.array(OptionSchema).length(3),
  correct_option: z.enum(['A', 'B', 'C']),
  audio_url: z.string().min(1).optional(),
});

export const KetListenChooseGenSchema = z.object({ items: z.array(ItemSchema).length(5) });

const StoredItemSchema = ItemSchema.extend({
  options: z.array(OptionSchema.extend({ image_url: z.string().min(1) })).length(3),
  audio_url: z.string().min(1),
});

export const KetListenChoosePlanSchema = z.object({ items: z.array(StoredItemSchema).length(5) });

export type KetListenChooseGen = z.infer<typeof KetListenChooseGenSchema>;
export type KetListenChoosePlan = z.infer<typeof KetListenChoosePlanSchema>;
