'use client';

import React from 'react';
import { Mic, Image } from 'lucide-react';
import { usePracticeChat, UsePracticeChatProps } from '@/hooks/usePracticeChat';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, TypingIndicator, SuggestionChip } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import { PhrasePhase } from './PhrasePhase';
import { ImagePhase } from './ImagePhase';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { useTranslations } from 'next-intl';

function PhraseBobMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <BobAvatar />
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm text-gray-800 shadow-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function PhraseUserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] text-sm shadow-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function PhraseDots({ scores, currentIndex, total, finished }: { scores: number[]; currentIndex: number; total: number; finished: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const score = scores[i];
        let cls = 'bg-gray-200';
        if (typeof score === 'number') cls = score >= 50 ? 'bg-emerald-500' : 'bg-rose-400';
        else if (!finished && i === currentIndex) cls = 'bg-blue-500 ring-2 ring-blue-200';
        return <span key={i} className={`w-2 h-2 rounded-full ${cls}`} />;
      })}
    </div>
  );
}

function SaveErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="shrink-0 bg-red-50 border-t border-red-200 px-4 py-1.5">
      <p className="text-xs text-red-600 text-center">{error}</p>
    </div>
  );
}

export function BobPracticeChat(props: UsePracticeChatProps) {
  const t = useTranslations('chat.bobPractice');
  const chat = usePracticeChat(props);

  const handleBackWithRecordingGuard = () => {
    if (chat.isRecording) chat.stopRecording();
    props.onBack();
  };

  const isImageMode = props.mode === 'image';

  const situationLevelHeader =
    !isImageMode && (props.level === 'b1' || props.level === 'b2')
      ? {
          icon: Mic,
          title: 'Phrase Practice',
          subtitle:
            props.level === 'b1'
              ? 'Cambridge PET · 10 phrases out loud'
              : 'Cambridge FCE · 10 phrases out loud',
          accentColor: (props.level === 'b1' ? 'emerald' : 'sky') as 'emerald' | 'sky',
        }
      : null;

  const headerConfig = isImageMode
    ? {
        icon: Image,
        title: t('headerImage.title'),
        subtitle: t('headerImage.subtitle'),
        accentColor: 'purple' as const,
      }
    : situationLevelHeader ?? {
        icon: Mic,
        title: t('headerSituation.title'),
        subtitle: t('headerSituation.subtitle'),
        accentColor: 'blue' as const,
      };

  const inputArea =
    props.mode === 'situation' ? (
      <>
        <SaveErrorBanner error={chat.saveError} />
        <PhrasePhase
          phase={chat.phase}
          inputText={chat.inputText}
          setInputText={chat.setInputText}
          handleTopicSubmit={chat.handleTopicSubmit}
          handleAudioStart={chat.handleAudioStart}
          stopRecording={chat.stopRecording}
          isRecording={chat.isRecording}
          handleNext={chat.handleNext}
          handleRetry={chat.handleRetry}
          dynamicPhrases={chat.dynamicPhrases}
          currentIndex={chat.currentIndex}
          onBack={chat.onBack}
          topic={chat.topic}
        />
      </>
    ) : (
      <>
        <SaveErrorBanner error={chat.saveError} />
        <ImagePhase
          phase={chat.phase}
          handleAudioStart={chat.handleAudioStart}
          stopRecording={chat.stopRecording}
          handleNextImage={chat.handleNextImage}
          isRecording={chat.isRecording}
          onStopRecording={chat.stopRecording}
          handleRetry={chat.handleRetry}
        />
      </>
    );

  const backButton = (
    <button
      onClick={handleBackWithRecordingGuard}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label={t('backAriaLabel')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-500">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );

  const isSituation = props.mode === 'situation';
  const phraseTotal = chat.dynamicPhrases.length > 0 ? chat.dynamicPhrases.length : 10;
  const showCelebration = isSituation && chat.phase === 'finished' && chat.phraseScores.length > 0;

  const rightSlot = isSituation && chat.dynamicPhrases.length > 0 ? (
    <PhraseDots
      scores={chat.phraseScores}
      currentIndex={chat.currentIndex}
      total={phraseTotal}
      finished={chat.phase === 'finished'}
    />
  ) : undefined;

  const usePhraseStyle = !!situationLevelHeader;
  const isHistoryView = !!props.initialMessages && props.initialMessages.length > 0;

  return (
    <div className="relative flex flex-col h-full">
    <ChatShell
      headerConfig={{ ...headerConfig, leftSlot: backButton, rightSlot }}
      footerConfig={{
        modeLabel: situationLevelHeader
          ? props.level === 'b1' ? 'CAMBRIDGE PET · PHRASE PRACTICE' : 'CAMBRIDGE FCE · PHRASE PRACTICE'
          : isImageMode ? t('footerModeImage') : t('footerModeSituation'),
        modelName: ACTIVE_MODEL_LABEL,
      }}
      inputSlot={inputArea}
      animationKey={props.mode}
      maxWidthClass={usePhraseStyle ? 'max-w-full' : undefined}
    >
      {chat.messages.map((msg) =>
        usePhraseStyle ? (
          msg.role === 'user' ? (
            <PhraseUserMessage key={msg.id}>{msg.content}</PhraseUserMessage>
          ) : (
            <PhraseBobMessage key={msg.id}>{msg.content}</PhraseBobMessage>
          )
        ) : (
          <MessageBubble
            key={msg.id}
            variant={msg.role === 'user' ? 'user' : 'assistant'}
            icon={isImageMode ? Image : Mic}
            accentColor={isImageMode ? 'purple' : 'blue'}
          >
            {msg.content}
          </MessageBubble>
        )
      )}
      {(chat.phase === 'evaluating' || chat.phase === 'generating') && (
        <TypingIndicator />
      )}
      {showCelebration && isHistoryView && (
        <div className="mt-4">
          <CelebrationCard
            score={chat.averageScore}
            scoreMax={100}
            animate={false}
            actionLabel="Done"
            onAction={props.onBack}
          />
        </div>
      )}
      {props.mode === 'situation' && chat.phase === 'phrase-ready' && chat.dynamicPhrases.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {chat.dynamicPhrases.slice(0, 3).map((phrase, i) => (
            <SuggestionChip
              key={i}
              text={phrase}
              onClick={() => {}}
              disabled={chat.isRecording}
            />
          ))}
        </div>
      )}
    </ChatShell>
    {showCelebration && !isHistoryView && (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/95 backdrop-blur-sm p-6">
        <div className="w-full max-w-md">
          <CelebrationCard
            score={chat.averageScore}
            scoreMax={100}
            animate={true}
            actionLabel="Done"
            onAction={props.onBack}
          />
        </div>
      </div>
    )}
    </div>
  );
}
