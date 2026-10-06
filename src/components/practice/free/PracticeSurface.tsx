'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { MessageBubble, TypingIndicator } from '@/components/chat';
import { ConversationMessages } from '@/components/conversation/ConversationMessages';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import { PracticeControls } from './PracticeControls';
import { PracticeImagePanel } from './PracticeImagePanel';
import { PracticeFinished } from './PracticeFinished';
import { usePracticeTurn } from '@/hooks/practice/usePracticeTurn';
import { finishPracticeAction } from '@/actions/practice/finish';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { PracticeResultPayload } from '@/lib/practice/messages';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { ChatMessage } from '@/actions/gemini/types';
import type { CefrLevel } from '@/lib/types/practice';

export interface PracticeSurfaceProps {
  sessionId: string | null;
  organizationId: string | null;
  imageUrl: string | null;
  initialResult: PracticeResultPayload | null;
  onSessionCreated: (sessionId: string) => void;
  onSessionFinished: () => void;
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
  framing: string;
  messages: ChatMessage[];
  turnSignals?: PracticeTurnSignal[];
  onExit: () => void;
  onRestart: () => void;
}

export function PracticeSurface({
  sessionId,
  organizationId,
  imageUrl,
  initialResult,
  onSessionCreated,
  onSessionFinished,
  mode,
  seed,
  level,
  framing,
  messages,
  turnSignals,
  onExit,
  onRestart,
}: PracticeSurfaceProps) {
  const t = useTranslations('practice');
  const [result, setResult] = useState<PracticeResultPayload | null>(initialResult);
  const [finishFailed, setFinishFailed] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const turn = usePracticeTurn({
    sessionId,
    organizationId,
    initialImageUrl: imageUrl,
    onSessionCreated,
    mode,
    seed,
    level,
    initialFraming: framing,
    initialMessages: messages,
    initialTurnSignals: turnSignals,
  });

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishFailed(false);
    const finished = await finishPracticeAction(turn.sessionId, turn.turnSignals);
    setFinishing(false);
    if (!finished.persisted) {
      setFinishFailed(true);
      return;
    }
    setResult(finished);
    onSessionFinished();
  };

  const finishedView = result ? (
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
  ) : null;

  const allTextsVisible = Object.fromEntries(turn.messages.map((_message, index) => [index, true]));

  const conversationMessages = (visibleTexts: Record<number, boolean>, listenFirst: boolean) => (
    <ConversationMessages
      framing={turn.framing}
      messages={turn.messages}
      visibleTexts={visibleTexts}
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
      listenFirst={listenFirst}
    />
  );

  if (result && initialResult) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
          {turn.mode === 'picture' && (
            <PracticeImagePanel
              imageUrl={turn.imageUrl}
              loading={false}
              loadingLabel={t('image.loading')}
              unavailableLabel={t('image.unavailable')}
            />
          )}
          {conversationMessages(allTextsVisible, false)}
        </div>
        {finishedView}
      </div>
    );
  }

  if (finishedView) return finishedView;

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

        {finishFailed && (
          <div className="mb-3">
            <ConversationErrorBanner
              message={t('errors.finishError')}
              retryLabel={t('errors.retry')}
              onRetry={handleFinish}
            />
          </div>
        )}

        {turn.errorMessage && (
          <div className="mb-3">
            <ConversationErrorBanner
              message={t(`errors.${turn.errorMessage}`)}
              retryLabel={turn.canRetry ? t('errors.retry') : t('errors.dismiss')}
              onRetry={turn.canRetry ? turn.retryLastTurn : turn.dismissError}
            />
          </div>
        )}

        {conversationMessages(turn.visibleTexts, turn.mode === 'conversation')}

        {turn.pendingTurn && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%]">
                <MessageBubble variant="user" noAnimate>
                  <span className="flex items-center gap-2 opacity-80">
                    <Loader2 size={14} className="animate-spin" />
                    {turn.pendingTurn.text ?? t('pendingTurn.processingVoice')}
                  </span>
                </MessageBubble>
              </div>
            </div>
            <TypingIndicator />
            {turn.isSlow && (
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pl-11">
                {t('pendingTurn.stillWorking')}
              </p>
            )}
          </div>
        )}
      </div>

      <PracticeControls
        labels={{
          placeholder: t('controls.placeholder'),
          modelAnswer: t('controls.modelAnswer'),
          exit: t('controls.exit'),
          finish: t('controls.finish'),
          recording: t('controls.recording'),
        }}
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
