import { z } from 'zod';

export const PET_READING_SECTIONS = ['comprehension', 'vocabulary', 'grammar'] as const;

const McqQuestionSchema = z.object({
  number: z.number().int().min(1).max(10),
  section: z.enum(PET_READING_SECTIONS),
  type: z.literal('mcq'),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(['A', 'B', 'C']),
  feedback: z.object({ A: z.string(), B: z.string(), C: z.string() }),
});

const OpenQuestionSchema = z.object({
  number: z.number().int().min(1).max(10),
  section: z.enum(PET_READING_SECTIONS),
  type: z.literal('open'),
  question: z.string().min(1),
  accept: z.array(z.string().min(1)).min(1),
  feedback: z.string(),
});

const QuestionSchema = z.discriminatedUnion('type', [McqQuestionSchema, OpenQuestionSchema]);

const SECTION_ORDER = [...Array(4).fill('comprehension'), ...Array(3).fill('vocabulary'), ...Array(3).fill('grammar')];

export const PetReadingComprehensionPlanSchema = z
  .object({
    title: z.string().min(1),
    topics: z.array(z.string()).min(1),
    text: z.string().min(1),
    questions: z.array(QuestionSchema).length(10),
  })
  .superRefine((value, ctx) => {
    const mismatch = SECTION_ORDER.some((section, index) => value.questions[index]?.section !== section);
    if (mismatch) ctx.addIssue({ code: 'custom', message: 'section distribution mismatch' });
  });

export type PetReadingComprehensionPlan = z.infer<typeof PetReadingComprehensionPlanSchema>;
export type PetReadingQuestion = PetReadingComprehensionPlan['questions'][number];
