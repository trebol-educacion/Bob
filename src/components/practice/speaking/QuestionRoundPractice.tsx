'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { useQuestionRound } from './useQuestionRound';
import {
  QuestionRoundError,
  QuestionRoundHeader,
  QuestionRoundMicDenied,
  QuestionRoundResult,
} from './QuestionRoundScreens';
import { QuestionRoundStage } from './QuestionRoundStage';
import type { QuestionRoundPracticeProps } from './types';

export function QuestionRoundPractice<TPlan>({ config, onBack, ...sessionParams }: QuestionRoundPracticeProps<TPlan>) {
  const t = useTranslations('cambridge');
  const round = useQuestionRound(config, sessionParams);

  const header = (
    <QuestionRoundHeader
      title={config.headerTitle}
      subtitle={config.headerSubtitle}
      levelBadge={config.levelBadge}
      onBack={onBack}
    />
  );

  if (round.error && !round.micDenied) {
    return <QuestionRoundError header={header} message={round.error} onRetry={round.handleTryAgain} onBack={onBack} />;
  }

  if (!round.ready) {
    return <BobMascotLoader message={config.loadingMessage} />;
  }

  if (round.evaluating) {
    return <BobMascotLoader message={t('common.evaluatingPerformance')} />;
  }

  if (round.micDenied) {
    return <QuestionRoundMicDenied header={header} onDismiss={round.dismissMicDenied} />;
  }

  if (round.evaluation) {
    return (
      <QuestionRoundResult
        header={header}
        title={config.completeTitle}
        subtitle={config.completeSubtitle}
        feedback={round.evaluation}
        onTryAgain={round.handleTryAgain}
        onBack={onBack}
      />
    );
  }

  return (
    <QuestionRoundStage
      header={header}
      planIntro={round.plan && round.questionIndex === 0 ? config.renderPlanIntro?.(round.plan) : null}
      question={round.currentQuestion}
      questionIndex={round.questionIndex}
      totalQuestions={round.questions.length}
      step={round.step}
      isRecordingNow={round.isRecordingNow}
      recordingSeconds={round.recordingSeconds}
      currentReaction={round.currentReaction}
      playbackUrl={round.playbackUrl}
      hearingQuestion={round.hearingQuestion}
      onHearQuestion={round.handleHearQuestion}
      onStartRecording={round.handleStartRecording}
      onStopRecording={round.handleStopRecording}
      onRetry={round.handleRetry}
      onSend={round.handleSend}
    />
  );
}
