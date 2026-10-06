import { z } from 'zod';

export const PETInterviewPlanSchema = z.object({
  phase1_questions: z.array(z.string()).min(1),
  topicA: z.string(),
  topicA_questions: z.array(z.string()).min(1),
  topicA_followup: z.string(),
  topicBC: z.string(),
  topicBC_questions: z.array(z.string()).min(1),
  topicBC_followup: z.string(),
  closing: z.string(),
});

export type PETInterviewPlan = z.infer<typeof PETInterviewPlanSchema>;

export const PETDiscussionPlanSchema = z.object({
  topic: z.string(),
  link: z.string(),
  questions: z.array(z.string()).min(1),
  closing: z.string(),
});

export type PETDiscussionPlan = z.infer<typeof PETDiscussionPlanSchema>;
