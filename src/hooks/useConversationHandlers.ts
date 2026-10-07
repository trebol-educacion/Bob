import { useEffect, useRef } from 'react';
import {
  ChatMessage,
  chatConversationAction,
  chatTextConversationAction,
  simulateUserResponseAction,
  generateSpeechAction,
  generateQuestionsAction,
  simulateConversationAction,
  checkTopicIsAppropriateAction,
} from '@/actions/gemini';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import { playClip } from '@/lib/audio-clip';
import { finishGenericSessionAction, recordGenericTurnAction } from '@/actions/generic-session';
import type { CefrLevel } from '@/lib/types/practice';
import type { UseConversationStateReturn } from './useConversationState';
import type { UseQuestionsFlowReturn } from './useQuestionsFlow';

export interface UseConversationHandlersArgs {
  conv: UseConversationStateReturn;
  qf: UseQuestionsFlowReturn;
  maxTurns: number;
  level: CefrLevel;
  sessionId?: string;
  onSessionStart?: (topic: string) => Promise<string | undefined>;
  onSessionFinished?: () => void;
  onError: (message: string) => void;
}

export interface UseConversationHandlersReturn {
  onRecordedRef: React.RefObject<(blob: Blob) => void>;
  persistTurns: (turns: ChatMessage[]) => Promise<boolean>;
  handleListen: (text: string, index: number) => Promise<void>;
  handleSendMessage: (audioBlob: Blob) => Promise<void>;
  handleSendTextMessage: () => Promise<void>;
  handleSimulateResponse: () => Promise<void>;
  handleGoToQuestions: () => Promise<void>;
  handleAnswerQuestion: (audioBlob: Blob) => Promise<void>;
  handleTopicConfirm: () => Promise<void>;
}

export function useConversationHandlers({
  conv,
  qf,
  maxTurns,
  level,
  sessionId,
  onSessionStart,
  onSessionFinished,
  onError,
}: UseConversationHandlersArgs): UseConversationHandlersReturn {
  const onRecordedRef = useRef<(blob: Blob) => void>(() => {});

  const sessionIdRef = useRef<string | undefined>(sessionId);

  useEffect(() => {
    if (sessionId) sessionIdRef.current = sessionId;
  }, [sessionId]);

  const persistTurns = async (turns: ChatMessage[]): Promise<boolean> => {
    const sid = sessionIdRef.current;
    const messages = turns
      .filter((turn) => turn.text)
      .map((turn) => ({
        role: turn.role === 'model' ? ('bob' as const) : ('user' as const),
        msgType: 'text' as const,
        contentText: turn.text,
      }));
    if (!sid || messages.length === 0) return true;
    const result = await recordGenericTurnAction({ sessionId: sid, messages });
    if (!result.ok) onError('saveError');
    return result.ok;
  };

  const handleListen = async (text: string, index: number) => {
    if (conv.isGeneratingAudio !== null) return;

    conv.setIsGeneratingAudio(index);
    try {
      const { data, mimeType } = await generateSpeechAction(text);
      const audioUrl = pcmToWavBase64(data, mimeType);
      conv.incrementPlayCount(index);

      await playClip(audioUrl).finished;
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      conv.setIsGeneratingAudio(null);
    }
  };

  const handleSendMessage = async (audioBlob: Blob) => {
    conv.setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];

      const result = await chatConversationAction(base64Audio, mimeType, conv.messages, conv.internalTopic, level);

      const userMsg: ChatMessage = { role: 'user', text: result.evaluation.transcribed_text };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...conv.messages, userMsg, modelMsg];
      conv.setMessages(newMessages);
      conv.setCurrentEvaluation(result.evaluation);
      conv.setShowEvaluation(true);
      await persistTurns([userMsg, modelMsg]);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Conversation error:', error);
      onError('conversationError');
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleSendTextMessage = async () => {
    if (!conv.inputText.trim() || conv.isProcessing) return;

    conv.setIsProcessing(true);
    const textToSend = conv.inputText.trim();
    conv.setInputText('');

    try {
      const result = await chatTextConversationAction(textToSend, conv.messages, conv.internalTopic, level);

      const userMsg: ChatMessage = { role: 'user', text: textToSend };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...conv.messages, userMsg, modelMsg];
      conv.setMessages(newMessages);
      conv.setCurrentEvaluation(result.evaluation);
      conv.setShowEvaluation(true);
      await persistTurns([userMsg, modelMsg]);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Text conversation error:', error);
      onError('sendMessageError');
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleSimulateResponse = async () => {
    if (conv.isProcessing) return;
    conv.setIsProcessing(true);

    try {
      const simulatedText = await simulateUserResponseAction(conv.messages, conv.internalTopic, level);
      const result = await chatTextConversationAction(simulatedText, conv.messages, conv.internalTopic, level);

      const userMsg: ChatMessage = { role: 'user', text: simulatedText };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...conv.messages, userMsg, modelMsg];
      conv.setMessages(newMessages);
      conv.setCurrentEvaluation(result.evaluation);
      conv.setShowEvaluation(true);
      await persistTurns([userMsg, modelMsg]);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleGoToQuestions = async () => {
    conv.setIsProcessing(true);
    try {
      let finalHistory = conv.messages;
      if (conv.messages.length < maxTurns) {
        finalHistory = await simulateConversationAction(conv.messages, conv.internalTopic, level);
        conv.setMessages(finalHistory);
      }

      const aiQuestions = await generateQuestionsAction(finalHistory, conv.internalTopic, level);
      qf.setQuestions(aiQuestions);
      conv.setPhase('questions');
    } catch (error) {
      console.error('Error switching to questions:', error);
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleAnswerQuestion = async (audioBlob: Blob) => {
    conv.setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];

      const currentQuestion = qf.questions[qf.currentQuestionIndex];

      const result = await chatConversationAction(
        base64Audio,
        mimeType,
        conv.messages,
        `Evaluating answer to: ${currentQuestion.question}. Correct info: ${currentQuestion.correct_answer}`,
        level
      );

      qf.recordAnswer(qf.currentQuestionIndex, result.evaluation);

      const hasMore = qf.advanceQuestion();
      if (!hasMore) {
        const scores = [...Object.values(qf.questionAnswers).map((answer) => answer.score), result.evaluation.score];
        const sid = sessionIdRef.current;
        if (sid) {
          const finished = await finishGenericSessionAction({ sessionId: sid, scores });
          if (finished.ok) onSessionFinished?.();
          else onError('saveError');
        }
        conv.setPhase('finished');
      }
    } catch (error) {
      console.error('Error answering question:', error);
    } finally {
      conv.setIsProcessing(false);
    }
  };

  useEffect(() => {
    onRecordedRef.current = async (blob: Blob) => {
      if (conv.phase === 'conversation') {
        await handleSendMessage(blob);
      } else if (conv.phase === 'questions') {
        await handleAnswerQuestion(blob);
      }
    };
  });

  const handleTopicConfirm = async () => {
    const topic = conv.topicInput.trim();
    if (!topic) return;

    conv.setIsProcessing(true);
    try {
      const guard = await checkTopicIsAppropriateAction(topic);
      if (!guard.appropriate) {
        onError('topicNotAppropriate');
        return;
      }
    } catch (error) {
      console.error('Topic guard failed:', error);
    } finally {
      conv.setIsProcessing(false);
    }

    const startedId = await onSessionStart?.(topic);
    if (startedId) sessionIdRef.current = startedId;
    else onError('saveError');
    conv.setInternalTopic(topic);
    conv.setPhase('conversation');
  };

  return {
    onRecordedRef: onRecordedRef as React.RefObject<(blob: Blob) => void>,
    persistTurns,
    handleListen,
    handleSendMessage,
    handleSendTextMessage,
    handleSimulateResponse,
    handleGoToQuestions,
    handleAnswerQuestion,
    handleTopicConfirm,
  };
}
