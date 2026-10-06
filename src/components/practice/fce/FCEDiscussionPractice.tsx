'use client';

import React from 'react';
import {
  evaluateFCEDiscussionAction,
  generateFCEDiscussionAction,
  processFCEDiscussionAnswerAction,
} from '@/actions/modes/fce-p4';
import { DiscussionPlanSchema, type FCEDiscussionPlan } from '@/lib/speaking/fce-content';
import { unwrapContent } from '@/lib/content/unwrap-content';
import type { ActivityRenderProps } from '@/lib/routing';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export type FCEDiscussionPracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

const FCE_DISCUSSION_UI_CONFIG: QuestionRoundConfig<FCEDiscussionPlan> = {
  planSchema: DiscussionPlanSchema,
  headerTitle: 'Speaking · Part 4: Discussion',
  headerSubtitle: 'Cambridge B2 First',
  levelBadge: 'B2',
  loadingMessage: 'Getting your discussion ready…',
  completeTitle: 'Discussion complete!',
  completeSubtitle: 'Cambridge B2 · Part 4',
  toQuestions: (plan) => plan.discussion_questions,
  actions: {
    generate: async () => unwrapContent(await generateFCEDiscussionAction()),
    processAnswer: processFCEDiscussionAnswerAction,
    evaluate: evaluateFCEDiscussionAction,
  },
};

export function FCEDiscussionPractice(props: FCEDiscussionPracticeProps) {
  return <QuestionRoundPractice config={FCE_DISCUSSION_UI_CONFIG} {...props} />;
}
