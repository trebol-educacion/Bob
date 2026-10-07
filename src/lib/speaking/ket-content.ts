import { z } from 'zod';

export const A2SessionPlanSchema = z.object({
  phase1_questions: z.array(z.string()).length(3),
  topic1: z.string(),
  topic1_questions: z.array(z.string()).length(4),
  topic2: z.string(),
  topic2_questions: z.array(z.string()).length(3),
  final_question: z.string(),
  exam_part: z.string().optional(),
  bank_group_id: z.string().optional(),
});

export type A2SessionPlan = z.infer<typeof A2SessionPlanSchema>;

export const A2_SESSION_PLAN_FALLBACK: A2SessionPlan = {
  phase1_questions: ['What is your name?', 'How old are you?', 'Where do you live?'],
  topic1: 'School',
  topic1_questions: ['Do you like school?', 'What is your favourite subject?', 'Who is your best friend?', 'What do you do after school?'],
  topic2: 'Free time',
  topic2_questions: ['What do you do at the weekend?', 'Do you play any sports?', 'What is your favourite hobby?'],
  final_question: 'What do you want to do when you grow up?',
};

/**
 * @param plan KET Part 1 interview plan
 * @returns questions in the order they are asked
 */
export function a2InterviewQuestions(plan: A2SessionPlan): string[] {
  return [...plan.phase1_questions, ...plan.topic1_questions, ...plan.topic2_questions, plan.final_question];
}
