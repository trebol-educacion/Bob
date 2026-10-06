import { z } from 'zod';
import { GenerationSchema as PictureGenerationSchema } from '../../src/actions/modes/fce-p2/contracts';

type Raw = unknown;

const ClozeOption = z.object({ id: z.string(), text: z.string().min(1) });

const ClozeRaw = z.object({
  title: z.string().min(1),
  example: z.object({
    sentence: z.string().min(1),
    options: z.array(ClozeOption).length(4),
    correct_option: z.string().min(1),
  }),
  text_with_gaps: z.string().min(1),
  gaps: z.array(
    z.object({
      number: z.number().int(),
      options: z.array(ClozeOption).length(4),
      correct_option: z.string().min(1),
      explanation: z.string().min(1),
    }),
  ),
});

const EssayRaw = z.object({
  title: z.string().min(1),
  essay_question: z.string().min(1),
  context: z.string().min(1),
  notes: z.array(z.object({ id: z.number(), label: z.string(), description: z.string() })),
  word_target_min: z.number().optional(),
  word_target_max: z.number().optional(),
});

const InterviewRaw = z.object({ questions: z.array(z.string()) });
const DiscussionRaw = z.object({ discussion_questions: z.array(z.string()) });

const asOptions = (options: { id: string; text: string }[]) => options.map((o) => ({ key: o.id, label: o.text }));

function clozePayload(raw: z.infer<typeof ClozeRaw>, topic: string) {
  const gaps = [...raw.gaps].sort((a, b) => a.number - b.number);
  return {
    group: {
      stimulus_text: raw.text_with_gaps,
      metadata: {
        title: raw.title,
        topic,
        question_range: '1-8',
        example: {
          number: 0,
          sentence: raw.example.sentence,
          options: asOptions(raw.example.options),
          answer: raw.example.correct_option,
        },
      },
    },
    items: gaps.map((gap, index) => ({
      group_order: index + 1,
      question: String(gap.number),
      options: asOptions(gap.options),
      correct_key: gap.correct_option,
      explanation: gap.explanation,
      metadata: { number: gap.number },
    })),
  };
}

function textPayload(metadata: Record<string, unknown>) {
  return { group: { stimulus_text: null, metadata }, items: [] };
}

export type Adapter = (raw: Raw, topic: string) => unknown;

export const ADAPTERS: Record<string, Adapter> = {
  fce_reading_part1: (raw, topic) => {
    const parsed = ClozeRaw.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    return clozePayload(parsed.data, topic);
  },
  fce_writing_part1: (raw, topic) => {
    const parsed = EssayRaw.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    return textPayload({ ...parsed.data, topic });
  },
  fce_speaking_part1: (raw, topic) => {
    const parsed = InterviewRaw.safeParse(raw);
    if (!parsed.success) throw new Error('questions: array of strings required');
    return textPayload({ topic, questions: parsed.data.questions });
  },
  fce_speaking_part2: (raw) => {
    const parsed = PictureGenerationSchema.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    return textPayload({ ...parsed.data });
  },
  fce_speaking_part4: (raw, topic) => {
    const parsed = DiscussionRaw.safeParse(raw);
    if (!parsed.success) throw new Error('discussion_questions: array of strings required');
    return textPayload({ topic, questions: parsed.data.discussion_questions });
  },
};
