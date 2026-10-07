'use client';

import React from 'react';
import { startFCEReadingPart7Action, submitFCEReadingPart7Action } from '@/actions/modes/fce-reading-part7';
import { GroupExerciseFrame } from '@/components/practice/group-exercise/GroupExerciseFrame';
import { toMatchingReview, type GroupPracticeProps, choiceGroupApi } from '@/components/practice/group-exercise/types';
import { useGroupExercise } from '@/components/practice/group-exercise/useGroupExercise';
import { useActivityRules } from '@/hooks/useActivityRules';
import { MatchingBoard } from '@/components/practice/matching';

const API = choiceGroupApi(startFCEReadingPart7Action, submitFCEReadingPart7Action);

export type FCEReadingMatchingPracticeProps = GroupPracticeProps;

export function FCEReadingMatchingPractice({ onBack, onOpenDashboard, ...session }: FCEReadingMatchingPracticeProps) {
  const rules = useActivityRules('fce_reading_part7');
  const controller = useGroupExercise({ api: API, ...session });
  const { exercise, answers, result, phase, setAnswer } = controller;

  const review = phase === 'finished' ? toMatchingReview(result) : undefined;

  return (
    <GroupExerciseFrame
      controller={controller}
      examPart="fce_reading_part7"
      title="Reading Part 7, Multiple Matching"
      subtitle="Read the four sections and match each statement"
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    >
      {exercise && (
        <>
          <p className="text-base font-bold text-gray-800">{exercise.title}</p>
          <MatchingBoard
            choices={exercise.choices}
            questions={exercise.questions}
            answers={answers}
            onAnswer={phase === 'ready' ? setAnswer : undefined}
            review={review}
            allowRepeatOptions={rules.allowRepeatOptions ?? true}
          />
        </>
      )}
    </GroupExerciseFrame>
  );
}
