import { z } from 'zod';

export const OFFICIAL_LISTENING_PARTS = [
  'toefl_listening_conversation',
  'toefl_listening_announcement',
  'toefl_listening_academic_talk',
] as const;

export type OfficialListeningPart = (typeof OFFICIAL_LISTENING_PARTS)[number];

const KeySchema = z.enum(['A', 'B', 'C', 'D']);

const OptionSchema = z.object({ key: KeySchema, label: z.string().min(1) });

const QuestionSchema = z.object({
  number: z.number().int().positive(),
  question: z.string().min(1),
  options: z.array(OptionSchema).length(4),
  correct_key: KeySchema,
});

export const ToeflOfficialListeningPlanSchema = z.object({
  directions: z.string().min(1),
  audio_url: z.string().min(1),
  transcript: z.string().min(1),
  questions: z.array(QuestionSchema).min(1),
});

export type ToeflOfficialListeningPlan = z.infer<typeof ToeflOfficialListeningPlanSchema>;

/**
 * @param value candidate exam part
 * @returns true when the part is one of the official TOEFL listening parts
 */
export function isOfficialListeningPart(value: string): value is OfficialListeningPart {
  return (OFFICIAL_LISTENING_PARTS as readonly string[]).includes(value);
}
