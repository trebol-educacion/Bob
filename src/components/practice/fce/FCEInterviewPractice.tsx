'use client';

import React from 'react';
import {
  evaluateFCEInterviewAction,
  generateFCEInterviewAction,
  processFCEInterviewAnswerAction,
} from '@/actions/modes/fce-p1';
import { FCE_INTERVIEW_MODE, type FCEInterviewPlan } from '@/lib/speaking/fce-content';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export interface FCEInterviewPracticeProps {
  onBack: () => void;
}

const FCE_INTERVIEW_UI_CONFIG: QuestionRoundConfig<FCEInterviewPlan> = {
  mode: FCE_INTERVIEW_MODE,
  sessionTitle: 'B2 Speaking, Part 1',
  headerTitle: 'Speaking · Part 1: Interview',
  headerSubtitle: 'Cambridge B2 First',
  levelBadge: 'B2',
  loadingMessage: 'Getting your interview ready…',
  completeTitle: 'Interview complete!',
  completeSubtitle: 'Cambridge B2 · Part 1',
  toQuestions: (plan) => plan.questions,
  actions: {
    generate: generateFCEInterviewAction,
    processAnswer: processFCEInterviewAnswerAction,
    evaluate: evaluateFCEInterviewAction,
  },
};

export function FCEInterviewPractice({ onBack }: FCEInterviewPracticeProps) {
  return <QuestionRoundPractice config={FCE_INTERVIEW_UI_CONFIG} onBack={onBack} />;
}
