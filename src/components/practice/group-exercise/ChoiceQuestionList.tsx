import React from 'react';
import type { GroupItemResult, GroupQuestion } from '@/lib/item-bank/group-types';

export interface ChoiceQuestionListProps {
  questions: GroupQuestion[];
  answers: Record<string, string>;
  onAnswer?: (questionId: string, key: string) => void;
  results?: Record<string, GroupItemResult>;
}

function optionClasses(key: string, selected: string | undefined, result: GroupItemResult | undefined): string {
  if (result) {
    if (key === result.correct_key) return 'border-green-300 bg-green-50 text-green-800';
    if (key === selected) return 'border-red-300 bg-red-50 text-red-700';
    return 'border-gray-100 bg-gray-50 text-gray-400';
  }
  return key === selected
    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 cursor-pointer'
    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 cursor-pointer';
}

export function ChoiceQuestionList({ questions, answers, onAnswer, results }: ChoiceQuestionListProps) {
  return (
    <div className="space-y-4">
      {questions.map((question) => {
        const result = results?.[question.id];
        return (
          <div key={question.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3" data-testid={`question-${question.number}`}>
            <p className="text-sm font-bold text-gray-800">
              <span className="mr-2 text-indigo-600">{question.number}</span>
              {question.text}
            </p>
            <div className="flex flex-col gap-2" role="group" aria-label={`Question ${question.number}`}>
              {question.options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={result !== undefined}
                  aria-pressed={answers[question.id] === option.key}
                  onClick={() => onAnswer?.(question.id, option.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${optionClasses(option.key, answers[question.id], result)}`}
                >
                  <span className="font-bold mr-2">{option.key}.</span>
                  {option.label}
                </button>
              ))}
            </div>
            {result?.explanation && <p className="text-xs text-gray-500 leading-relaxed">{result.explanation}</p>}
          </div>
        );
      })}
    </div>
  );
}
