'use client';

import React from 'react';
import { startFCEListeningPart2Action, submitFCEListeningPart2Action } from '@/actions/modes/fce-listening-part2';
import { GapText, splitGapText, type GapReview } from '@/components/practice/gap-text';
import { GroupAudioPlayer } from '@/components/practice/group-exercise/GroupAudioPlayer';
import { GroupExerciseFrame } from '@/components/practice/group-exercise/GroupExerciseFrame';
import { resultsByItem, type GroupPracticeProps, choiceGroupApi } from '@/components/practice/group-exercise/types';
import { useGroupExercise } from '@/components/practice/group-exercise/useGroupExercise';
import type { GroupItemResult, GroupQuestion } from '@/lib/item-bank/group-types';

const API = choiceGroupApi(startFCEListeningPart2Action, submitFCEListeningPart2Action);

export type FCEListeningGapFillPracticeProps = GroupPracticeProps;

function gapNumberOf(question: GroupQuestion): number {
  const gap = splitGapText(question.text).find((segment) => segment.kind === 'gap');
  return gap && gap.kind === 'gap' ? gap.number : question.number;
}

function toReview(gapNumber: number, result: GroupItemResult | undefined): Record<number, GapReview> | undefined {
  if (!result) return undefined;
  return { [gapNumber]: { isCorrect: result.is_correct, given: result.given, expected: result.correct_key } };
}

export function FCEListeningGapFillPractice({ onBack, onOpenDashboard, ...session }: FCEListeningGapFillPracticeProps) {
  const controller = useGroupExercise({ api: API, ...session });
  const { exercise, answers, result, phase, setAnswer } = controller;
  const results = phase === 'finished' ? resultsByItem(result) : {};

  return (
    <GroupExerciseFrame
      controller={controller}
      title="Listening Part 2, Sentence Completion"
      subtitle="Listen and complete the sentences"
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
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
            {exercise.questions.map((question) => {
              const gapNumber = gapNumberOf(question);
              return (
                <p key={question.id} className="text-sm text-gray-800 leading-loose" data-testid={`question-${question.number}`}>
                  <GapText
                    text={question.text}
                    mode="input"
                    values={{ [gapNumber]: answers[question.id] ?? '' }}
                    onChange={phase === 'ready' ? (_, value) => setAnswer(question.id, value) : undefined}
                    review={toReview(gapNumber, results[question.id])}
                  />
                </p>
              );
            })}
          </div>
        </>
      )}
    </GroupExerciseFrame>
  );
}
