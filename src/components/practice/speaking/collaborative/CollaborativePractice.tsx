'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CollaborativeConversation } from './CollaborativeConversation';
import { CollaborativeIntro } from './CollaborativeIntro';
import { CollaborativeResult } from './CollaborativeResult';
import { useCollaborativeSession } from './useCollaborativeSession';
import type { CollaborativePracticeProps } from './types';

const DEFAULT_SCOPE = 'b1.collaborative';

export function CollaborativePractice({ config, onBack, ...sessionParams }: CollaborativePracticeProps) {
  const t = useTranslations('cambridge');
  const translationScope = config.translationScope ?? DEFAULT_SCOPE;
  const session = useCollaborativeSession(config, sessionParams);

  if (session.phase === 'intro') {
    return (
      <CollaborativeIntro
        presets={config.presets}
        scenario={session.scenario}
        loadingScenario={session.loadingScenario}
        maxTurns={config.maxTurns}
        translationScope={translationScope}
        onSelectPreset={session.selectScenario}
        onSurpriseMe={session.handleSurpriseMe}
        onStart={session.handleStart}
        onBack={onBack}
      />
    );
  }

  if (session.phase === 'evaluating') {
    return <BobMascotLoader message={t(`${translationScope}.evaluatingPerformance`)} />;
  }

  if (session.phase === 'result' && session.evaluation) {
    return <CollaborativeResult feedback={session.evaluation} translationScope={translationScope} onTryAgain={session.handleTryAgain} onBack={onBack} />;
  }

  return (
    <CollaborativeConversation
      scenario={session.scenario}
      history={session.history}
      discussedOptions={session.discussedOptions}
      userTurns={session.userTurns}
      maxTurns={config.maxTurns}
      finishEarlyAfterTurns={config.finishEarlyAfterTurns}
      translationScope={translationScope}
      isProcessing={session.isProcessing}
      isRecording={session.isRecording}
      ttsLoading={session.ttsLoading}
      audioError={session.audioError}
      showTextInput={session.showTextInput}
      textInput={session.textInput}
      onTextChange={session.setTextInput}
      onToggleText={session.toggleTextInput}
      onTextSubmit={session.handleTextSubmit}
      onStartRecording={session.startRecording}
      onStopRecording={session.stopRecording}
      onEvaluate={session.handleEvaluate}
      onBack={onBack}
    />
  );
}
