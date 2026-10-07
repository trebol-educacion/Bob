'use client';

import React from 'react';
import { generateA2SessionAction, processA2AnswerAction, evaluateA2FinalAction } from '@/actions/modes/a2';
import { unwrapContent } from '@/lib/content/unwrap-content';
import type { ActivityRenderProps } from '@/lib/routing';
import { A2SessionPlanSchema, a2InterviewQuestions, type A2SessionPlan } from '@/lib/speaking/ket-content';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export type A2Part1PracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

const A2_PART1_CONFIG: QuestionRoundConfig<A2SessionPlan> = {
  planSchema: A2SessionPlanSchema,
  headerTitle: 'A2, Part 1 Interview',
  headerSubtitle: 'Speaking · A2, Part 1 Speaking',
  levelBadge: 'A2',
  loadingMessage: 'Preparing your A2 interview…',
  completeTitle: 'Interview Complete!',
  completeSubtitle: 'Cambridge A2 · Part 1',
  toQuestions: a2InterviewQuestions,
  actions: {
    generate: async () => unwrapContent(await generateA2SessionAction()),
    processAnswer: processA2AnswerAction,
    evaluate: evaluateA2FinalAction,
  },
};

export function A2Part1Practice(props: A2Part1PracticeProps) {
  return <QuestionRoundPractice config={A2_PART1_CONFIG} {...props} />;
}
