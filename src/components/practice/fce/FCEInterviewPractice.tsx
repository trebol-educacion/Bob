'use client';

import React from 'react';
import {
  evaluateFCEInterviewAction,
  generateFCEInterviewAction,
  processFCEInterviewAnswerAction,
} from '@/actions/modes/fce-p1';
import { InterviewPlanSchema, type FCEInterviewPlan } from '@/lib/speaking/fce-content';
import { unwrapContent } from '@/lib/content/unwrap-content';
import type { ActivityRenderProps } from '@/lib/routing';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export type FCEInterviewPracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

const FCE_INTERVIEW_UI_CONFIG: QuestionRoundConfig<FCEInterviewPlan> = {
  planSchema: InterviewPlanSchema,
  headerTitle: 'Speaking · Part 1: Interview',
  headerSubtitle: 'Cambridge B2 First',
  levelBadge: 'B2',
  loadingMessage: 'Getting your interview ready…',
  completeTitle: 'Interview complete!',
  completeSubtitle: 'Cambridge B2 · Part 1',
  toQuestions: (plan) => plan.questions,
  actions: {
    generate: async () => unwrapContent(await generateFCEInterviewAction()),
    processAnswer: processFCEInterviewAnswerAction,
    evaluate: evaluateFCEInterviewAction,
  },
};

export function FCEInterviewPractice(props: FCEInterviewPracticeProps) {
  return <QuestionRoundPractice config={FCE_INTERVIEW_UI_CONFIG} {...props} />;
}
