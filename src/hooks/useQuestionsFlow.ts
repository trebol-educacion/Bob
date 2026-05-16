import { useState } from 'react';
import { Question, EvaluationResult } from '@/actions/gemini';

interface UseQuestionsFlowReturn {
  questions: Question[];
  currentQuestionIndex: number;
  questionAnswers: Record<number, EvaluationResult>;
  setQuestions: (questions: Question[]) => void;
  recordAnswer: (index: number, result: EvaluationResult) => void;
  /** Returns true if there are more questions remaining. */
  advanceQuestion: () => boolean;
}

export function useQuestionsFlow(): UseQuestionsFlowReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, EvaluationResult>>({});

  const recordAnswer = (index: number, result: EvaluationResult) => {
    setQuestionAnswers(prev => ({ ...prev, [index]: result }));
  };

  const advanceQuestion = (): boolean => {
    const hasMore = currentQuestionIndex < questions.length - 1;
    if (hasMore) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
    return hasMore;
  };

  return {
    questions,
    currentQuestionIndex,
    questionAnswers,
    setQuestions,
    recordAnswer,
    advanceQuestion,
  };
}
