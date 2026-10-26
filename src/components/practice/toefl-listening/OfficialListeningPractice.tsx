'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChoiceQuestionList } from '@/components/practice/group-exercise/ChoiceQuestionList';
import { GroupExerciseFrame } from '@/components/practice/group-exercise/GroupExerciseFrame';
import { resultsByItem, type GroupPracticeProps } from '@/components/practice/group-exercise/types';
import { useGroupExercise } from '@/components/practice/group-exercise/useGroupExercise';
import type { OfficialListeningPart } from '@/lib/bank-plans/toefl-official-listening';
import { OFFICIAL_LISTENING_APIS } from './official-listening-api';
import { OfficialListeningStimulus } from './OfficialListeningStimulus';

export interface OfficialListeningPracticeProps extends GroupPracticeProps {
  part: OfficialListeningPart;
}

/** @param props OfficialListeningPracticeProps */
export function OfficialListeningPractice({ part, onBack, onOpenDashboard, ...session }: OfficialListeningPracticeProps) {
  const t = useTranslations('toefl.officialListening');
  const controller = useGroupExercise({ api: OFFICIAL_LISTENING_APIS[part], ...session });
  const { exercise, answers, result, phase, setAnswer } = controller;
  const finished = phase === 'finished';

  return (
    <GroupExerciseFrame
      controller={controller}
      examPart={part}
      title={t(`titles.${part}`)}
      subtitle={t('subtitle')}
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    >
      {exercise && (
        <>
          <OfficialListeningStimulus
            directions={exercise.title}
            audioPath={exercise.audioUrl}
            listenLabel={t('listenLabel')}
            transcript={finished ? (result?.transcript ?? null) : null}
            transcriptLabel={t('transcript')}
          />
          <ChoiceQuestionList
            questions={exercise.questions}
            answers={answers}
            onAnswer={phase === 'ready' ? setAnswer : undefined}
            results={finished ? resultsByItem(result) : undefined}
          />
        </>
      )}
    </GroupExerciseFrame>
  );
}
