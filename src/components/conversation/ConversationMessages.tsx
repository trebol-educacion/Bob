import React from 'react';
import { motion } from 'motion/react';
import { Volume2, HelpCircle, Loader2, MessageSquare, BookOpen } from 'lucide-react';
import { MessageBubble, InfoCard } from '@/components/chat';
import type { ChatMessage } from '@/actions/gemini/types';

export interface ConversationMessagesProps {
  framing: string;
  messages: ChatMessage[];
  visibleTexts: Record<number, boolean>;
  playCounts: Record<number, number>;
  isGeneratingAudio: number | null;
  onListen: (text: string, index: number) => void;
  onToggleVisibleText: (index: number) => void;
  scenarioTitle: string;
  listenAudioLabel: string;
  repeatAudioLabel: string;
  playAudioLabel: string;
  showHintLabel: string;
  hideTextLabel: string;
  listenFirst: boolean;
}

export function ConversationMessages({
  framing,
  messages,
  visibleTexts,
  playCounts,
  isGeneratingAudio,
  onListen,
  onToggleVisibleText,
  scenarioTitle,
  listenAudioLabel,
  repeatAudioLabel,
  playAudioLabel,
  showHintLabel,
  hideTextLabel,
  listenFirst,
}: ConversationMessagesProps) {
  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      {framing && (
        <InfoCard title={scenarioTitle} icon={BookOpen}>
          <p className="italic">&quot;{framing}&quot;</p>
        </InfoCard>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] relative group ${msg.role === 'user' ? '' : 'min-w-[200px]'}`}>
            <MessageBubble
              variant={msg.role === 'user' ? 'user' : 'assistant'}
              icon={MessageSquare}
              accentColor="blue"
              noAnimate
            >
              {msg.role === 'model' ? (
                <div className="flex flex-col space-y-2">
                  {listenFirst && !visibleTexts[i] ? (
                    <div className="flex items-center space-x-2 py-1 text-gray-400">
                      <Volume2 size={16} className="animate-pulse" />
                      <span className="text-sm font-medium italic">{listenAudioLabel}</span>
                    </div>
                  ) : (
                    <p className="animate-in fade-in slide-in-from-top-1 duration-300">{msg.text}</p>
                  )}
                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => onListen(msg.text, i)}
                      disabled={isGeneratingAudio !== null}
                      className="flex items-center space-x-2 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--color-bob-brand)' }}
                    >
                      {isGeneratingAudio === i ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Volume2 size={12} />
                      )}
                      <span>{playCounts[i] > 0 ? repeatAudioLabel : playAudioLabel}</span>
                    </button>
                    {listenFirst && playCounts[i] >= 2 && (
                      <button
                        onClick={() => onToggleVisibleText(i)}
                        className="flex items-center space-x-1 text-bob-brand transition-colors"
                      >
                        <HelpCircle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">
                          {visibleTexts[i] ? hideTextLabel : showHintLabel}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                msg.text
              )}
            </MessageBubble>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
