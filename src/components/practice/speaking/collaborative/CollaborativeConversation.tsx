'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Loader2, MessageSquare, Mic, MicOff, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import type { Part3ChatMessage, Part3Scenario } from '@/lib/speaking/types';
import { CollaborativeBackButton } from './CollaborativeBackButton';

interface ConversationProps {
  scenario: Part3Scenario | null;
  history: Part3ChatMessage[];
  discussedOptions: Set<number>;
  userTurns: number;
  maxTurns: number;
  finishEarlyAfterTurns: number;
  isProcessing: boolean;
  isRecording: boolean;
  ttsLoading: boolean;
  audioError: string | null;
  showTextInput: boolean;
  textInput: string;
  onTextChange: (value: string) => void;
  onToggleText: () => void;
  onTextSubmit: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEvaluate: () => void;
  onBack: () => void;
}

function OptionsSidebar({ scenario, discussedOptions }: Pick<ConversationProps, 'scenario' | 'discussedOptions'>) {
  const t = useTranslations('cambridge');
  return (
    <div className="hidden md:flex flex-col gap-2 w-44 shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto p-3">
      <p className="text-xs font-bold text-trebol-text/50 uppercase tracking-widest mb-1">{t('b1.collaborative.optionsSidebarLabel')}</p>
      {scenario?.options.map((option, index) => (
        <div
          key={option}
          className={`flex items-start gap-2 text-xs p-2 rounded-lg transition-colors ${
            discussedOptions.has(index)
              ? 'bg-green-100 text-green-700'
              : 'bg-white text-trebol-text/70 border border-gray-200'
          }`}
        >
          {discussedOptions.has(index) ? (
            <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          ) : (
            <Circle size={12} className="mt-0.5 shrink-0" />
          )}
          <span className="font-medium">{option}</span>
        </div>
      ))}
    </div>
  );
}

function ConversationControls(props: ConversationProps) {
  const t = useTranslations('cambridge');
  const { userTurns, maxTurns, isProcessing, isRecording, ttsLoading, showTextInput, textInput } = props;

  return (
    <div className="flex-none border-t border-gray-100 bg-white">
      <AnimatePresence>
        {props.audioError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {props.audioError}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTextInput && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-4 pt-2 flex gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => props.onTextChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && props.onTextSubmit()}
              placeholder="Type your response…"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-trebol-text focus:outline-none focus:border-trebol-primary"
              autoFocus
            />
            <button
              onClick={props.onTextSubmit}
              disabled={!textInput.trim() || isProcessing}
              className="bg-trebol-primary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {t('common.send')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4 flex items-center justify-center gap-3 relative">
        {userTurns >= maxTurns && (
          <button
            onClick={props.onEvaluate}
            disabled={isProcessing}
            className="flex-1 max-w-xs bg-green-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            {t('b1.collaborative.finishEvaluate')}
          </button>
        )}

        {userTurns < maxTurns && (
          <>
            <button
              onClick={isRecording ? props.onStopRecording : props.onStartRecording}
              disabled={isProcessing || ttsLoading}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md disabled:opacity-50 ${
                isRecording
                  ? 'bg-red-500 text-white scale-110 animate-pulse'
                  : 'bg-trebol-primary text-white hover:opacity-90'
              }`}
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <button
              onClick={props.onToggleText}
              disabled={isRecording || isProcessing}
              className="text-xs text-trebol-text/50 hover:text-trebol-text transition-colors font-medium disabled:opacity-30"
            >
              {showTextInput ? t('b1.collaborative.hideText') : t('b1.collaborative.typeInstead')}
            </button>

            {userTurns >= props.finishEarlyAfterTurns && (
              <button
                onClick={props.onEvaluate}
                disabled={isProcessing || isRecording}
                className="text-xs text-trebol-text/40 hover:text-trebol-primary transition-colors font-medium disabled:opacity-30"
              >
                {t('b1.collaborative.finishEarly')}
              </button>
            )}
          </>
        )}

        {ttsLoading && (
          <Volume2 size={16} className="text-trebol-text/30 animate-pulse absolute right-6" />
        )}
      </div>
    </div>
  );
}

export function CollaborativeConversation(props: ConversationProps) {
  const t = useTranslations('cambridge');

  const body = (
    <div className="flex min-h-0 gap-0">
      <OptionsSidebar scenario={props.scenario} discussedOptions={props.discussedOptions} />
      <div className="flex-1 space-y-3 min-w-0">
        {props.history.map((msg, index) => (
          <MessageBubble
            key={index}
            variant={msg.role === 'user' ? 'user' : 'assistant'}
            icon={MessageSquare}
            accentColor="blue"
            noAnimate
          >
            {msg.role === 'examiner' && (
              <p className="text-[10px] font-bold opacity-50 mb-1 uppercase tracking-wider">{t('b1.collaborative.examiner')}</p>
            )}
            <p className="leading-relaxed">{msg.text}</p>
          </MessageBubble>
        ))}

        {props.isProcessing && (
          <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs opacity-60">{t('b1.collaborative.examinerResponding')}</span>
            </div>
          </MessageBubble>
        )}
      </div>
    </div>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: MessageSquare,
        title: props.scenario?.topic ?? 'Collaborative Task',
        subtitle: t('b1.collaborative.conversationSubtitle'),
        accentColor: 'blue',
        online: true,
        leftSlot: <CollaborativeBackButton onBack={props.onBack} />,
        rightSlot: (
          <span className="text-xs font-bold text-trebol-primary bg-trebol-secondary/20 px-3 py-1 rounded-full">
            {t('b1.collaborative.turnOf', { current: props.userTurns, max: props.maxTurns })}
          </span>
        ),
      }}
      footerConfig={{ modeLabel: t('b1.collaborative.footerCollaborativeLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={<ConversationControls {...props} />}
      animationKey="b1-conversation"
    >
      {body}
    </ChatShell>
  );
}
