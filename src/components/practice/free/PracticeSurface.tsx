'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConversationMessages } from '@/components/conversation/ConversationMessages';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import { PracticeControls } from './PracticeControls';
import { PracticeImagePanel } from './PracticeImagePanel';
import { PracticeFinished } from './PracticeFinished';
import { usePracticeTurn } from '@/hooks/practice/usePracticeTurn';
import { finishPracticeAction } from '@/actions/practice/finish';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export interface PracticeSurfaceProps {
  sessionId: string | null;
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
  framing: string;
  message: string;
  onExit: () => void;
  onRestart: () => void;
}

export function PracticeSurface({ sessionId, mode, seed, level, framing, message, onExit, onRestart }: PracticeSurfaceProps) {
  const t = useTranslations('practice');
  const [result, setResult] = useState<{ score: number; detail: { participation: number; fluency: number; independence: number; comprehension: number }; feedback: string } | null>(null);
  const [finishing, setFinishing] = useState(false);

  const turn = usePracticeTurn({ sessionId, mode, seed, level, initialFraming: framing, initialMessage: message });

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    const finished = await finishPracticeAction(sessionId, turn.turnSignals);
    setResult(finished);
    setFinishing(false);
  };

  if (result) {
    return (
      <PracticeFinished
        score={result.score}
        detail={result.detail}
        feedback={result.feedback}
        labels={{
          title: t('finished.title'),
          scoreLabel: t('finished.scoreLabel'),
          again: t('finished.again'),
          home: t('finished.home'),
          criteria: {
            participation: t('finished.criteria.participation'),
            fluency: t('finished.criteria.fluency'),
            independence: t('finished.criteria.independence'),
            comprehension: t('finished.criteria.comprehension'),
          },
        }}
        onRestart={onRestart}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {turn.mode === 'picture' && (
          <PracticeImagePanel
            imageUrl={turn.imageUrl}
            loading={turn.imageLoading}
            loadingLabel={t('image.loading')}
            unavailableLabel={t('image.unavailable')}
          />
        )}

        {turn.errorMessage && (
          <div className="mb-3">
            <ConversationErrorBanner
              message={t(`errors.${turn.errorMessage}`)}
              retryLabel={t('errors.retry')}
              onRetry={turn.dismissError}
            />
          </div>
        )}

        <ConversationMessages
          framing={turn.framing}
          messages={turn.messages}
          visibleTexts={turn.visibleTexts}
          playCounts={turn.playCounts}
          isGeneratingAudio={turn.isGeneratingAudio}
          onListen={(_text, index) => turn.handleListen(index)}
          onToggleVisibleText={turn.handleToggleHint}
          scenarioTitle={t('scenarioTitle')}
          listenAudioLabel={t('listenAudioLabel')}
          repeatAudioLabel={t('repeatAudioLabel')}
          playAudioLabel={t('playAudioLabel')}
          showHintLabel={t('showHintLabel')}
          hideTextLabel={t('hideTextLabel')}
        />
      </div>

      <PracticeControls
        labels={{
          placeholder: t('controls.placeholder'),
          modelAnswer: t('controls.modelAnswer'),
          exit: t('controls.exit'),
          finish: t('controls.finish'),
          modes: {
            conversation: t('modes.conversation'),
            situation: t('modes.situation'),
            picture: t('modes.picture'),
          },
        }}
        mode={turn.mode}
        onSwitchMode={turn.handleSwitchMode}
        inputText={turn.inputText}
        onInputTextChange={turn.setInputText}
        onSendText={turn.handleSendText}
        onSendAudio={turn.handleSendAudio}
        onRequestModelAnswer={turn.handleRequestModelAnswer}
        onExit={onExit}
        onFinish={handleFinish}
        isProcessing={turn.isProcessing || finishing}
        pendingModelAnswer={turn.pendingModelAnswer}
      />
    </div>
  );
}
