'use client';

import React from 'react';
import { Mic, Image } from 'lucide-react';
import { usePracticeChat, UsePracticeChatProps } from '@/hooks/usePracticeChat';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, TypingIndicator, SuggestionChip } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/actions/gemini';
import { PhrasePhase } from './PhrasePhase';
import { ImagePhase } from './ImagePhase';

// ─── Save error banner ────────────────────────────────────────────────────────

function SaveErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="shrink-0 bg-red-50 border-t border-red-200 px-4 py-1.5">
      <p className="text-xs text-red-600 text-center">{error}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BobPracticeChat(props: UsePracticeChatProps) {
  const chat = usePracticeChat(props);

  const handleBackWithRecordingGuard = () => {
    if (chat.isRecording) chat.stopRecording();
    props.onBack();
  };

  const isImageMode = props.mode === 'image';

  const headerConfig = isImageMode
    ? {
        icon: Image,
        title: 'Bob — Imágenes',
        subtitle: 'DESCRIBE LO QUE VES',
        accentColor: 'purple' as const,
      }
    : {
        icon: Mic,
        title: 'Bob — Situaciones',
        subtitle: 'PRONUNCIACIÓN EN INGLÉS',
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

  // Build a back button for the left slot
  const backButton = (
    <button
      onClick={handleBackWithRecordingGuard}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="Volver"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-500">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );

  return (
    <ChatShell
      headerConfig={{ ...headerConfig, leftSlot: backButton }}
      footerConfig={{
        modeLabel: isImageMode ? 'MODO IMÁGENES ACTIVO' : 'MODO SITUACIONES ACTIVO',
        modelName: ACTIVE_MODEL_LABEL,
      }}
      inputSlot={inputArea}
      animationKey={props.mode}
    >
      {chat.messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          variant={msg.role === 'user' ? 'user' : 'assistant'}
          icon={isImageMode ? Image : Mic}
          accentColor={isImageMode ? 'purple' : 'blue'}
        >
          {msg.content}
        </MessageBubble>
      ))}
      {(chat.phase === 'evaluating' || chat.phase === 'generating') && (
        <TypingIndicator />
      )}
      {/* Suggestion chips — shown only in phrase-ready state for situation mode */}
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
  );
}
