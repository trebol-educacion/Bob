'use client';

import React from 'react';
import { usePracticeChat, UsePracticeChatProps } from '@/hooks/usePracticeChat';
import { PhrasePhase } from './PhrasePhase';
import { ImagePhase } from './ImagePhase';

// ─── Chat messages area ───────────────────────────────────────────────────────

function MessagesArea({
  messages,
  messagesEndRef,
}: Pick<ReturnType<typeof usePracticeChat>, 'messages' | 'messagesEndRef'>) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-slate-50/40">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          {msg.role === 'bob' && (
            <div className="w-8 h-8 rounded-full bg-trebol-primary text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
              B
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              msg.role === 'bob'
                ? 'bg-white border border-trebol-border rounded-tl-none text-trebol-text'
                : 'bg-trebol-primary text-white rounded-tr-none'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

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

  const inputArea =
    props.mode === 'situation' ? (
      <PhrasePhase
        phase={chat.phase}
        inputText={chat.inputText}
        setInputText={chat.setInputText}
        handleTopicSubmit={chat.handleTopicSubmit}
        handleAudioStart={chat.handleAudioStart}
        stopRecording={chat.stopRecording}
        isRecording={chat.isRecording}
        handleNext={chat.handleNext}
        dynamicPhrases={chat.dynamicPhrases}
        currentIndex={chat.currentIndex}
        onBack={chat.onBack}
        topic={chat.topic}
      />
    ) : (
      <ImagePhase
        phase={chat.phase}
        handleAudioStart={chat.handleAudioStart}
        stopRecording={chat.stopRecording}
        handleNextImage={chat.handleNextImage}
      />
    );

  return (
    <div className="flex flex-col h-full bg-white">
      <MessagesArea messages={chat.messages} messagesEndRef={chat.messagesEndRef} />
      <SaveErrorBanner error={chat.saveError} />
      {inputArea}
    </div>
  );
}
