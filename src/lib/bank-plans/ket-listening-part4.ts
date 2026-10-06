import { z } from 'zod';

export const KET_CHAR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const PersonSchema = z.object({
  number: z.number().int().min(1).max(5),
  name: z.string().min(1),
  monologue: z.string().min(1),
  correct_key: z.enum(KET_CHAR_KEYS),
  audio_url: z.string().min(1).optional(),
});

const CharacteristicSchema = z.object({ key: z.enum(KET_CHAR_KEYS), text: z.string().min(1) });

export const KetShortTalksGenSchema = z.object({
  people: z.array(PersonSchema).length(5),
  characteristics: z.array(CharacteristicSchema).length(8),
});

export const KetShortTalksPlanSchema = z.object({
  people: z.array(PersonSchema.extend({ audio_url: z.string().min(1) })).length(5),
  characteristics: z.array(CharacteristicSchema).length(8),
});

export type KetShortTalksGen = z.infer<typeof KetShortTalksGenSchema>;
export type KetShortTalksPlan = z.infer<typeof KetShortTalksPlanSchema>;
