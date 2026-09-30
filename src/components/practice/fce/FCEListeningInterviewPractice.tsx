'use client';

import React from 'react';
import { startFCEListeningPart4Action, submitFCEListeningPart4Action } from '@/actions/modes/fce-listening-part4';
import { ChoiceQuestionList } from '@/components/practice/group-exercise/ChoiceQuestionList';
import { GroupAudioPlayer } from '@/components/practice/group-exercise/GroupAudioPlayer';
import { GroupExerciseFrame } from '@/components/practice/group-exercise/GroupExerciseFrame';
import { resultsByItem, type GroupPracticeProps } from '@/components/practice/group-exercise/types';
import { useGroupExercise, type GroupExerciseApi } from '@/components/practice/group-exercise/useGroupExercise';

const API: GroupExerciseApi = { start: startFCEListeningPart4Action, submit: submitFCEListeningPart4Action };

export type FCEListeningInterviewPracticeProps = GroupPracticeProps;

export function FCEListeningInterviewPractice({ onBack, onOpenDashboard, ...session }: FCEListeningInterviewPracticeProps) {
  const controller = useGroupExercise({ api: API, ...session });
  const { exercise, answers, result, phase, setAnswer } = controller;

  return (
    <GroupExerciseFrame
      controller={controller}
      title="Listening Part 4, Interview"
      subtitle="Listen to the interview and choose the best answer"
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    >
      {exercise && (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 text-center">
            <p className="text-base font-bold text-gray-800">{exercise.title}</p>
            {exercise.intro && <p className="text-sm text-gray-600">{exercise.intro}</p>}
            <GroupAudioPlayer audioPath={exercise.audioUrl} />
          </div>
          <ChoiceQuestionList
            questions={exercise.questions}
            answers={answers}
            onAnswer={phase === 'ready' ? setAnswer : undefined}
            results={phase === 'finished' ? resultsByItem(result) : undefined}
          />
        </>
      )}
    </GroupExerciseFrame>
  );
}
