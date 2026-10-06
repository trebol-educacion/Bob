import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MessageSquare } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { generateInitialChatAction, type ChatMessage } from '@/actions/gemini';
import type { CefrLevel } from '@/lib/types/practice';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useConversationState } from '@/hooks/useConversationState';
import { useQuestionsFlow } from '@/hooks/useQuestionsFlow';
import { useConversationHandlers } from '@/hooks/useConversationHandlers';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble } from '@/components/chat';
import { ConversationFinished } from '@/components/conversation/ConversationFinished';
import { ConversationMessages } from '@/components/conversation/ConversationMessages';
import { ConversationQuestions } from '@/components/conversation/ConversationQuestions';
import { ConversationControls } from '@/components/conversation/ConversationControls';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import { useTranslations } from 'next-intl';

interface ConversationPracticeProps {
  topic?: string;
  onFinish: () => void;
  noFrame?: boolean;
  onPhaseChange?: (label: string, iter?: string) => void;
  onSessionStart?: (topic: string) => Promise<string | undefined>;
  onSessionFinished?: () => void;
  level?: CefrLevel;
  sessionId?: string;
  initialMessages?: ChatMessage[];
}

const MAX_TURNS = 12;

export function ConversationPractice({
  topic: topicProp = '',
  onFinish,
  noFrame,
  onPhaseChange,
  onSessionStart,
  onSessionFinished,
  level = 'b1',
  sessionId,
  initialMessages = [],
}: ConversationPracticeProps) {
  const t = useTranslations('chat.conversation');
  const tErrors = useTranslations('errors');
  const conv = useConversationState(topicProp, initialMessages);
  const qf = useQuestionsFlow();

  const [errorKey, setErrorKey] = useState<string | null>(null);
  const handleError = useCallback((key: string) => {
    setErrorKey(key);
  }, []);
  const dismissError = useCallback(() => setErrorKey(null), []);

  const {
    onRecordedRef,
    persistTurns,
    handleListen,
    handleSendTextMessage,
    handleSimulateResponse,
    handleGoToQuestions,
    handleTopicConfirm,
  } = useConversationHandlers({ conv, qf, maxTurns: MAX_TURNS, level, sessionId, onSessionStart, onSessionFinished, onError: handleError });

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: useCallback((blob: Blob) => onRecordedRef.current(blob), [onRecordedRef]),
    onError: useCallback(() => handleError('microphoneAccess'), [handleError]),
  });

  useEffect(() => {
    if (!onPhaseChange) return;
    if (conv.phase === 'conversation') {
      const iter = Math.floor(conv.messages.length / 2);
      onPhaseChange(t('phaseListening'), iter > 0 ? t('turn', { n: iter }) : undefined);
    } else if (conv.phase === 'questions') {
      onPhaseChange(t('phaseComprehension'), undefined);
    }
  }, [conv.phase, conv.messages.length, onPhaseChange, t]);

  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current || !conv.internalTopic || initialMessages.length > 0) return;
    initDoneRef.current = true;

    const initChat = async () => {
      conv.setIsProcessing(true);
      try {
        const result = await generateInitialChatAction(conv.internalTopic, level);
        conv.setFraming(result.framing);
        conv.setMessages([{ role: 'model', text: result.message }]);
        await persistTurns([{ role: 'model', text: result.message }]);
        setTimeout(() => handleListen(result.message, 0), 500);
      } catch (error) {
        console.error('Failed to init chat:', error);
      } finally {
        conv.setIsProcessing(false);
      }
    };
    initChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.internalTopic]);

  const isTextMode = !isRecording && conv.phase !== 'questions';
  const headerIcon = isTextMode ? MessageSquare : Mic;
  const headerTitle = isTextMode ? t('headerTitleChat') : t('headerTitleConversation');
  const modeLabel = conv.phase === 'questions' ? t('modeLabelEvaluation') : t('modeLabelConversation');

  if (conv.phase === 'finished') {
    return (
      <ConversationFinished
        heading={t('finished.heading')}
        body={t('finished.body')}
        backButtonLabel={t('finished.backButton')}
        onFinish={onFinish}
      />
    );
  }

  const controlsSlot = (
    <>
      {errorKey && (
        <div className="px-4 pt-3">
          <ConversationErrorBanner
            message={t(`errors.${errorKey}` as Parameters<typeof t>[0])}
            retryLabel={tErrors('retry')}
            onRetry={dismissError}
          />
        </div>
      )}
    <ConversationControls
      phase={conv.phase}
      labels={{
        placeholderTopic: t('placeholderTopic'),
        placeholderAnswer: t('placeholderAnswer'),
        skipToQuestions: t('skipToQuestions'),
        simulateResponse: t('simulateResponse'),
        evaluateComprehension: t('evaluateComprehension'),
        speak: t('speak'),
        stop: t('stop'),
      }}
      showEvaluation={conv.showEvaluation}
      currentEvaluation={conv.currentEvaluation}
      onDismissEvaluation={() => conv.setShowEvaluation(false)}
      isRecording={isRecording}
      isProcessing={conv.isProcessing}
      topicInput={conv.topicInput}
      onTopicInputChange={conv.setTopicInput}
      onTopicConfirm={handleTopicConfirm}
      inputText={conv.inputText}
      onInputTextChange={conv.setInputText}
      onSendTextMessage={handleSendTextMessage}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onGoToQuestions={handleGoToQuestions}
      onSimulateResponse={handleSimulateResponse}
      messagesCount={conv.messages.length}
      maxTurns={MAX_TURNS}
    />
    </>
  );

  const bodyContent = (
    <>
      <AnimatePresence mode="wait">
        {conv.phase === 'topic-input' && (
          <motion.div key="topic-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue">
              <p>
                {t('topicPrompt')}
                <br />
                <span className="text-gray-400 text-xs">{t('topicPromptExample')}</span>
              </p>
            </MessageBubble>
          </motion.div>
        )}

        {conv.phase === 'conversation' && (
          <ConversationMessages
            framing={conv.framing}
            messages={conv.messages}
            visibleTexts={conv.visibleTexts}
            playCounts={conv.playCounts}
            isGeneratingAudio={conv.isGeneratingAudio}
            onListen={handleListen}
            onToggleVisibleText={conv.toggleVisibleText}
            scenarioTitle={t('scenarioTitle')}
            listenAudioLabel={t('listenAudio')}
            repeatAudioLabel={t('repeatAudio')}
            playAudioLabel={t('playAudio')}
            showHintLabel={t('showHint')}
            hideTextLabel={t('hideText')}
            listenFirst
          />
        )}

        {conv.phase === 'questions' && (
          <ConversationQuestions
            questions={qf.questions}
            currentQuestionIndex={qf.currentQuestionIndex}
            questionAnswers={qf.questionAnswers}
            counterLabel={t('questionCounter', { current: qf.currentQuestionIndex + 1, total: qf.questions.length })}
            feedbackLabel={t('feedbackLabel')}
          />
        )}

        {conv.isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-2">
              <Loader2 size={16} className="animate-spin text-bob-brand" />
              <span className="text-sm font-medium text-gray-500">
                {conv.phase === 'conversation' ? t('bobThinking') : t('evaluatingAnswer')}
              </span>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (noFrame) {
    return (
      <div className="w-full h-full flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/30">
          {bodyContent}
        </div>
        {controlsSlot}
      </div>
    );
  }

  return (
    <ChatShell
      headerConfig={{
        icon: headerIcon,
        title: headerTitle,
        subtitle: t('subtitleB1'),
        accentColor: 'blue',
        online: true,
      }}
      footerConfig={{ modeLabel, modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={controlsSlot}
      animationKey={`conversation-${conv.phase}`}
    >
      {bodyContent}
    </ChatShell>
  );
}
