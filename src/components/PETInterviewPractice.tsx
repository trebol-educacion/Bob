'use client';

import React from 'react';
import {
  generatePETInterviewAction,
  processPETInterviewAnswerAction,
  evaluatePETInterviewAction,
  type PETInterviewPlan,
} from '@/actions/modes/pet-p1';
import { QuestionRoundPractice, type QuestionRoundConfig } from '@/components/practice/speaking';

export interface PETInterviewPracticeProps {
  onBack: () => void;
}

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
  mode: 'cambridge_pet_p1',
  sessionTitle: 'B1 Speaking, Part 1',
  headerTitle: 'Speaking · Part 1: Interview',
  headerSubtitle: 'Cambridge B1 Preliminary',
  levelBadge: 'B1',
  loadingMessage: 'Getting your interview ready…',
  completeTitle: 'Interview complete!',
  completeSubtitle: 'Cambridge B1 · Part 1',
  toQuestions: petInterviewQuestions,
  actions: {
    generate: generatePETInterviewAction,
    processAnswer: processPETInterviewAnswerAction,
    evaluate: evaluatePETInterviewAction,
  },
};

export function PETInterviewPractice({ onBack }: PETInterviewPracticeProps) {
  return <QuestionRoundPractice config={PET_INTERVIEW_CONFIG} onBack={onBack} />;
}
