import type React from 'react';

export interface MatchingChoice {
  key: string;
  label: string;
  text?: string | null;
}

export interface MatchingQuestion {
  id: string;
  number: number;
  text: string;
}

export interface MatchingReview {
  isCorrect: boolean;
  correctKey: string;
}

export interface MatchingBoardProps {
  choices: MatchingChoice[];
  questions: MatchingQuestion[];
  answers: Record<string, string>;
  onAnswer?: (questionId: string, key: string) => void;
  review?: Record<string, MatchingReview>;
  renderQuestionExtra?: (question: MatchingQuestion) => React.ReactNode;
}
