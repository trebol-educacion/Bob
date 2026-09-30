'use client';

import React from 'react';
import {
  evaluateFCEDiscussionAction,
  generateFCEDiscussionAction,
  processFCEDiscussionAnswerAction,
} from '@/actions/modes/fce-p4';
import { FCE_DISCUSSION_MODE, type FCEDiscussionPlan } from '@/lib/speaking/fce-content';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export interface FCEDiscussionPracticeProps {
  onBack: () => void;
}

const FCE_DISCUSSION_UI_CONFIG: QuestionRoundConfig<FCEDiscussionPlan> = {
  mode: FCE_DISCUSSION_MODE,
  sessionTitle: 'B2 Speaking, Part 4',
  headerTitle: 'Speaking · Part 4: Discussion',
  headerSubtitle: 'Cambridge B2 First',
  levelBadge: 'B2',
  loadingMessage: 'Getting your discussion ready…',
  completeTitle: 'Discussion complete!',
  completeSubtitle: 'Cambridge B2 · Part 4',
  toQuestions: (plan) => plan.discussion_questions,
  actions: {
    generate: generateFCEDiscussionAction,
    processAnswer: processFCEDiscussionAnswerAction,
    evaluate: evaluateFCEDiscussionAction,
  },
};

export function FCEDiscussionPractice({ onBack }: FCEDiscussionPracticeProps) {
  return <QuestionRoundPractice config={FCE_DISCUSSION_UI_CONFIG} onBack={onBack} />;
}
