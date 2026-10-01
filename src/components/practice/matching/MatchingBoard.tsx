import React from 'react';
import { ChoiceReference } from './ChoiceReference';
import { MatchingQuestionRow } from './MatchingQuestionRow';
import type { MatchingBoardProps } from './types';

export function MatchingBoard({ choices, questions, answers, onAnswer, review, renderQuestionExtra }: MatchingBoardProps) {
  return (
    <div className="space-y-4">
      <ChoiceReference choices={choices} />
      {questions.map((question) => (
        <MatchingQuestionRow
          key={question.id}
          question={question}
          choices={choices}
          selected={answers[question.id]}
          onSelect={onAnswer ? (key) => onAnswer(question.id, key) : undefined}
          review={review?.[question.id]}
          extra={renderQuestionExtra?.(question)}
        />
      ))}
    </div>
  );
}
