'use client';

import React from 'react';
import {
  generatePETDiscussionAction,
  processPETDiscussionAnswerAction,
  evaluatePETDiscussionAction,
} from '@/actions/modes/pet-p4';
import type { ActivityRenderProps } from '@/lib/routing';
import { PETDiscussionPlanSchema, type PETDiscussionPlan } from '@/lib/speaking/pet-content';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';
import { ACCENT_DARK, ACCENT_TINT } from '@/components/practice/speaking/speaking-theme';

export type PETDiscussionPracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

function renderDiscussionTopic(plan: PETDiscussionPlan) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ background: ACCENT_TINT, borderColor: 'transparent' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT_DARK }}>Topic</p>
      <p className="text-sm font-bold" style={{ color: ACCENT_DARK }}>{plan.topic}</p>
      {plan.link && <p className="mt-1 text-xs text-gray-500 leading-snug">{plan.link}</p>}
    </div>
  );
}

const PET_DISCUSSION_CONFIG: QuestionRoundConfig<PETDiscussionPlan> = {
  planSchema: PETDiscussionPlanSchema,
  headerTitle: 'Speaking · Part 4: Discussion',
  headerSubtitle: 'Cambridge B1 Preliminary',
  levelBadge: 'B1',
  loadingMessage: 'Getting your discussion ready…',
  completeTitle: 'Discussion complete!',
  completeSubtitle: 'Cambridge B1 · Part 4',
  toQuestions: (plan) => [...plan.questions],
  renderPlanIntro: renderDiscussionTopic,
  actions: {
    generate: generatePETDiscussionAction,
    processAnswer: processPETDiscussionAnswerAction,
    evaluate: evaluatePETDiscussionAction,
  },
};

export function PETDiscussionPractice(props: PETDiscussionPracticeProps) {
  return <QuestionRoundPractice config={PET_DISCUSSION_CONFIG} {...props} />;
}
