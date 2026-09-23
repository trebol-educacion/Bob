import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import type { EvaluationResult, Question } from '@/actions/gemini';

export interface ConversationQuestionsProps {
  questions: Question[];
  currentQuestionIndex: number;
  questionAnswers: Record<number, EvaluationResult>;
  counterLabel: string;
  feedbackLabel: string;
}

export function ConversationQuestions({
  questions,
  currentQuestionIndex,
  questionAnswers,
  counterLabel,
  feedbackLabel,
}: ConversationQuestionsProps) {
  return (
    <motion.div
      key="questions"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 py-8"
    >
      <div className="text-center space-y-4">
        <div
          className="inline-block text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          {counterLabel}
        </div>
        <h3 className="text-2xl font-black text-gray-900 leading-tight">
          {questions[currentQuestionIndex]?.question}
        </h3>
      </div>
      {questionAnswers[currentQuestionIndex] && (
        <div className="bg-white p-4 border border-green-200 rounded-xl">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle size={16} className="text-green-500" />
            <span className="font-black text-xs uppercase text-green-600">{feedbackLabel}</span>
          </div>
          <p className="text-gray-700 font-medium italic">
            &quot;{questionAnswers[currentQuestionIndex].feedback}&quot;
          </p>
        </div>
      )}
    </motion.div>
  );
}
