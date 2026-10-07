import { formatHistory, type CollaborativeConfig } from './collaborative';
import {
  CollaborativeScenarioSchema,
  DiscussionPlanSchema,
  FCE_COLLABORATIVE_FALLBACK,
  FCE_COLLABORATIVE_MODE,
  FCE_DISCUSSION_MODE,
  FCE_INTERVIEW_MODE,
  InterviewPlanSchema,
  type FCEDiscussionPlan,
  type FCEInterviewPlan,
} from './fce-content';
import type { QuestionRoundConfig } from './question-round';

export const FCE_INTERVIEW_CONFIG: QuestionRoundConfig<FCEInterviewPlan> = {
  mode: FCE_INTERVIEW_MODE,
  promptPrefix: 'cambridge_fce_p1_b2',
  transcribePromptKey: 'cambridge_fce_p1_b2_transcribe',
  planCacheKey: 'cambridge-fce-p1-b2-plan',
  planSchema: InterviewPlanSchema,
  planFallback: {
    questions: [
      'Where are you from, and what do you like most about living there?',
      'What do you usually do in your free time?',
      'Tell me about something you are looking forward to.',
      'What kind of job or studies are you interested in, and why?',
    ],
  },
  logTag: 'FCE-p1',
  eventName: 'FCEInterview',
  examinerReaction: false,
  scoredEvaluation: true,
};

export const FCE_DISCUSSION_CONFIG: QuestionRoundConfig<FCEDiscussionPlan> = {
  mode: FCE_DISCUSSION_MODE,
  promptPrefix: 'cambridge_fce_p4_b2',
  transcribePromptKey: 'cambridge_fce_p4_b2_transcribe',
  planCacheKey: 'cambridge-fce-p4-b2-plan',
  planSchema: DiscussionPlanSchema,
  planFallback: {
    discussion_questions: [
      'Some people say technology makes life easier. To what extent do you agree?',
      'How do you think our habits will change over the next twenty years?',
      'Is it more important to have a stable job or to enjoy your work? Why?',
      'What can governments do to encourage people to look after the environment?',
    ],
  },
  logTag: 'FCE-p4',
  eventName: 'FCEDiscussion',
  examinerReaction: false,
  scoredEvaluation: true,
};

export const FCE_COLLABORATIVE_CONFIG: CollaborativeConfig = {
  mode: FCE_COLLABORATIVE_MODE,
  promptPrefix: 'cambridge_fce_p3_b2',
  scenarioCacheKey: 'cambridge-fce-p3-b2-scenario',
  scenarioFallback: FCE_COLLABORATIVE_FALLBACK,
  examLabel: 'Cambridge B2 First',
  logTag: 'FCE-p3',
  scenarioSchema: CollaborativeScenarioSchema,
  scoredEvaluation: true,
  templateVariables: ({ scenario, history, userTurn }) => ({
    TOPIC: scenario.topic,
    PROMPTS: scenario.options.join(' | '),
    HISTORY: formatHistory(history) || '(just starting)',
    TURN_INDEX: String(history.filter((m) => m.role === 'user').length + 1),
    USER_TURN: userTurn,
  }),
};
