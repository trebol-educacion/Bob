'use client';

import React from 'react';
import { startFCEListeningPart3Action, submitFCEListeningPart3Action } from '@/actions/modes/fce-listening-part3';
import { GroupAudioPlayer } from '@/components/practice/group-exercise/GroupAudioPlayer';
import { GroupExerciseFrame } from '@/components/practice/group-exercise/GroupExerciseFrame';
import { toMatchingReview, type GroupPracticeProps, choiceGroupApi } from '@/components/practice/group-exercise/types';
import { useGroupExercise } from '@/components/practice/group-exercise/useGroupExercise';
import { MatchingBoard } from '@/components/practice/matching';

const API = choiceGroupApi(startFCEListeningPart3Action, submitFCEListeningPart3Action);

export type FCEListeningMatchingPracticeProps = GroupPracticeProps;

export function FCEListeningMatchingPractice({ onBack, onOpenDashboard, ...session }: FCEListeningMatchingPracticeProps) {
  const controller = useGroupExercise({ api: API, ...session });
  const { exercise, answers, result, phase, setAnswer } = controller;

  const review = phase === 'finished' ? toMatchingReview(result) : undefined;

  const audioById = new Map((exercise?.questions ?? []).map((question) => [question.id, question.audioUrl]));

  return (
    <GroupExerciseFrame
      controller={controller}
      title="Listening Part 3, Multiple Matching"
      subtitle="Match each speaker to what they say"
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    >
      {exercise && (
        <>
          <p className="text-base font-bold text-gray-800">{exercise.intro ?? exercise.title}</p>
          <MatchingBoard
            choices={exercise.choices}
            questions={exercise.questions}
            answers={answers}
            onAnswer={phase === 'ready' ? setAnswer : undefined}
            review={review}
            renderQuestionExtra={(question) => (
              <GroupAudioPlayer audioPath={audioById.get(question.id) ?? null} label={`Play ${question.text}`} />
            )}
          />
        </>
      )}
    </GroupExerciseFrame>
  );
}
