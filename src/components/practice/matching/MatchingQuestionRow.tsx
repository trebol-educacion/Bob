import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { MatchingChoice, MatchingQuestion, MatchingReview } from './types';

export interface MatchingQuestionRowProps {
  question: MatchingQuestion;
  choices: MatchingChoice[];
  selected: string | undefined;
  onSelect?: (key: string) => void;
  review?: MatchingReview;
  extra?: React.ReactNode;
  takenKeys?: ReadonlySet<string>;
}

function keyClasses(key: string, selected: string | undefined, review: MatchingReview | undefined): string {
  if (review) {
    if (key === review.correctKey) return 'border-green-500 bg-green-500 text-white';
    if (key === selected) return 'border-red-400 bg-red-400 text-white';
    return 'border-gray-200 bg-white text-gray-300';
  }
  return key === selected
    ? 'border-indigo-600 bg-indigo-600 text-white'
    : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 cursor-pointer';
}

export function MatchingQuestionRow({ question, choices, selected, onSelect, review, extra, takenKeys }: MatchingQuestionRowProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3" data-testid={`question-${question.number}`}>
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 text-sm font-black flex items-center justify-center shrink-0">
          {question.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 flex-1 leading-snug">{question.text}</p>
        {review && (review.isCorrect ? <CheckCircle size={18} className="text-green-500 shrink-0" /> : <XCircle size={18} className="text-red-400 shrink-0" />)}
      </div>
      {extra}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Question ${question.number}`}>
        {choices.map((choice) => (
          <button
            key={choice.key}
            type="button"
            disabled={review !== undefined || (takenKeys?.has(choice.key) ?? false)}
            aria-pressed={selected === choice.key}
            aria-label={`Question ${question.number}: ${choice.key}`}
            onClick={() => onSelect?.(choice.key)}
            className={`w-9 h-9 rounded-full border-2 text-sm font-black transition disabled:cursor-not-allowed ${takenKeys?.has(choice.key) && !review ? 'opacity-30' : ''} ${keyClasses(choice.key, selected, review)}`}
          >
            {choice.key}
          </button>
        ))}
      </div>
    </div>
  );
}
