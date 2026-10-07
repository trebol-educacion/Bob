'use client';

import React from 'react';
import {
  generatePETInterviewAction,
  processPETInterviewAnswerAction,
  evaluatePETInterviewAction,
} from '@/actions/modes/pet-p1';
import { unwrapContent } from '@/lib/content/unwrap-content';
import type { ActivityRenderProps } from '@/lib/routing';
import { PETInterviewPlanSchema, type PETInterviewPlan } from '@/lib/speaking/pet-content';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export type PETInterviewPracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

function petInterviewQuestions(plan: PETInterviewPlan): string[] {
  return [
    ...plan.phase1_questions,
    ...plan.topicA_questions,
    plan.topicA_followup,
    ...plan.topicBC_questions,
    plan.topicBC_followup,
  ];
}

const PET_INTERVIEW_CONFIG: QuestionRoundConfig<PETInterviewPlan> = {
  planSchema: PETInterviewPlanSchema,
  headerTitle: 'Speaking · Part 1: Interview',
  headerSubtitle: 'Cambridge B1 Preliminary',
  levelBadge: 'B1',
  loadingMessage: 'Getting your interview ready…',
  completeTitle: 'Interview complete!',
  completeSubtitle: 'Cambridge B1 · Part 1',
  toQuestions: petInterviewQuestions,
  actions: {
    generate: async () => unwrapContent(await generatePETInterviewAction()),
    processAnswer: processPETInterviewAnswerAction,
    evaluate: evaluatePETInterviewAction,
  },
};

export function PETInterviewPractice(props: PETInterviewPracticeProps) {
  return <QuestionRoundPractice config={PET_INTERVIEW_CONFIG} {...props} />;
}
