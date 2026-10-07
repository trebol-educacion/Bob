import React from 'react';
import { ChoiceReference } from './ChoiceReference';
import { MatchingQuestionRow } from './MatchingQuestionRow';
import type { MatchingBoardProps } from './types';

function takenByOthers(answers: Record<string, string>, questionId: string): ReadonlySet<string> {
  return new Set(
    Object.entries(answers)
      .filter(([id, key]) => id !== questionId && key)
      .map(([, key]) => key),
  );
}

export function MatchingBoard({
  choices,
  questions,
  answers,
  onAnswer,
  review,
  renderQuestionExtra,
  allowRepeatOptions = true,
}: MatchingBoardProps) {
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
          takenKeys={allowRepeatOptions ? undefined : takenByOthers(answers, question.id)}
        />
      ))}
    </div>
  );
}
