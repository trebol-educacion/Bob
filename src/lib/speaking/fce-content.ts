import { z } from 'zod';
import type { Part3Scenario } from './types';

export const FCE_INTERVIEW_MODE = 'cambridge_fce_p1';
export const FCE_COLLABORATIVE_MODE = 'cambridge_fce_p3';
export const FCE_DISCUSSION_MODE = 'cambridge_fce_p4';

export const FCE_OWN_DISCUSSION_TOPIC =
  'a general topic of your choice (for example work, technology, the environment, education or travel); choose one yourself and keep every question linked to it';

export const InterviewPlanSchema = z.object({
  questions: z.array(z.string().min(1)).min(1).max(6),
});

export const DiscussionPlanSchema = z.object({
  discussion_questions: z.array(z.string().min(1)).min(1).max(6),
});

export type FCEInterviewPlan = z.infer<typeof InterviewPlanSchema>;
export type FCEDiscussionPlan = z.infer<typeof DiscussionPlanSchema>;

export const CollaborativeScenarioSchema = z
  .object({
    topic: z.string().min(1),
    prompts: z.array(z.string().min(1)).length(5),
    examiner_script: z.string().min(1),
    decision_question: z.string().min(1),
  })
  .transform((raw): Part3Scenario => ({
    topic: raw.topic,
    situation: raw.examiner_script,
    prompt_question: raw.decision_question,
    options: raw.prompts,
  }));

export const FCE_COLLABORATIVE_FALLBACK: Part3Scenario = {
  topic: 'What could a town do to encourage people to use public transport?',
  situation:
    'Talk together about how each of these ideas could encourage people to use public transport.',
  prompt_question: 'What are the advantages of these ideas?',
  options: ['Cheaper tickets', 'More frequent services', 'Better bus stops', 'Free parking outside the centre', 'A clear mobile app'],
};

export const FCE_COLLABORATIVE_PRESETS: Part3Scenario[] = [
  FCE_COLLABORATIVE_FALLBACK,
  {
    topic: 'How can a school help students to stay healthy?',
    situation:
      'Talk together about how each of these ideas could help students to stay healthy.',
    prompt_question: 'What are the advantages of these ideas?',
    options: ['Healthier canteen meals', 'Longer sports lessons', 'Quiet relaxation areas', 'Talks about sleep', 'A walk-to-school programme'],
  },
  {
    topic: 'What would make a new local museum attractive to young people?',
    situation:
      'Talk together about how each of these ideas could attract young people to a new museum.',
    prompt_question: 'What are the advantages of these ideas?',
    options: ['Interactive screens', 'Free entry for students', 'Evening events', 'A social media challenge', 'Workshops with local artists'],
  },
];
