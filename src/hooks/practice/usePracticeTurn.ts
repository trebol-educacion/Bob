'use client';

import { useEffect, useRef, useState } from 'react';
import {
  chatConversationAction,
  chatTextConversationAction,
  simulateUserResponseAction,
  generateSpeechAction,
} from '@/actions/gemini';
import type { ChatMessage } from '@/actions/gemini';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import { addPracticeTurnAction } from '@/actions/practice/repository';
import { generatePracticeImageAction } from '@/actions/practice/image';
import { isHintAvailable, markAssistedTurn } from '@/lib/practice/scaffolding';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export interface UsePracticeTurnArgs {
  sessionId: string | null;
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
  initialFraming: string;
  initialMessages: ChatMessage[];
  initialTurnSignals?: PracticeTurnSignal[];
}

export interface UsePracticeTurnReturn {
  mode: PracticeActivityMode;
  framing: string;
  messages: ChatMessage[];
  turnSignals: PracticeTurnSignal[];
  playCounts: Record<number, number>;
  visibleTexts: Record<number, boolean>;
  isGeneratingAudio: number | null;
  isProcessing: boolean;
  errorMessage: string | null;
  pendingModelAnswer: string | null;
  imageUrl: string | null;
  imageLoading: boolean;
  inputText: string;
  setInputText: (v: string) => void;
  handleListen: (index: number) => Promise<void>;
  handleToggleHint: (index: number) => void;
  handleSendText: () => Promise<void>;
  handleSendAudio: (blob: Blob) => Promise<void>;
  handleRequestModelAnswer: () => Promise<void>;
  dismissError: () => void;
}

/**
 * @param args UsePracticeTurnArgs
 */
export function usePracticeTurn(args: UsePracticeTurnArgs): UsePracticeTurnReturn {
  const { sessionId, mode, seed, initialFraming, initialMessages, initialTurnSignals, level } = args;

  const framing = initialFraming;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [turnSignals, setTurnSignals] = useState<PracticeTurnSignal[]>(initialTurnSignals ?? []);
  const [playCounts, setPlayCounts] = useState<Record<number, number>>({});
  const [visibleTexts, setVisibleTexts] = useState<Record<number, boolean>>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingModelAnswer, setPendingModelAnswer] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(mode === 'picture');
  const [inputText, setInputText] = useState('');

  const audioCacheRef = useRef<Map<number, string>>(new Map());
  const pendingHintRef = useRef(false);
  const pendingModelAnswerUsedRef = useRef(false);

  const persistTurn = (role: 'bob' | 'student', content: string, hintUsed = false, modelAnswerUsed = false) => {
    if (!sessionId) return;
    void addPracticeTurnAction({ sessionId, role, content, hintUsed, modelAnswerUsed }).catch((error) =>
      console.error('[usePracticeTurn] persistTurn failed:', error)
    );
  };

  useEffect(() => {
    if (mode !== 'picture' || imageUrl) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageLoading(true);
    (async () => {
      const result = sessionId ? await generatePracticeImageAction(sessionId, seed.topic) : { ok: false, imageUrl: null };
      if (cancelled) return;
      setImageUrl(result.imageUrl);
      setImageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, sessionId, seed.topic, imageUrl]);

  useEffect(() => {
    const lastIndex = messages.length - 1;
    if (lastIndex < 0 || messages[lastIndex].role !== 'model') return;
    if (audioCacheRef.current.has(lastIndex)) return;
    let cancelled = false;
    (async () => {
      const { data, mimeType } = await generateSpeechAction(messages[lastIndex].text);
      if (cancelled || !data) return;
      audioCacheRef.current.set(lastIndex, pcmToWavBase64(data, mimeType));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  const handleListen = async (index: number) => {
    if (isGeneratingAudio !== null) return;
    const cached = audioCacheRef.current.get(index);

    setPlayCounts((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));

    if (cached) {
      try {
        await new Audio(cached).play();
      } catch (error) {
        console.error('[usePracticeTurn] cached audio play failed:', error);
      }
      return;
    }

    setIsGeneratingAudio(index);
    try {
      const { data, mimeType } = await generateSpeechAction(messages[index].text);
      const audioUrl = pcmToWavBase64(data, mimeType);
      audioCacheRef.current.set(index, audioUrl);
      await new Audio(audioUrl).play();
    } catch (error) {
      console.error('[usePracticeTurn] handleListen failed:', error);
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  const handleToggleHint = (index: number) => {
    if (!isHintAvailable(playCounts[index] ?? 0)) return;
    pendingHintRef.current = true;
    setVisibleTexts((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const recordExchange = (userText: string, botText: string, turnScore: number | null, hasAudio: boolean) => {
    const usage = markAssistedTurn({
      hintUsed: pendingHintRef.current,
      modelAnswerUsed: pendingModelAnswerUsedRef.current,
    });

    setMessages((prev) => [...prev, { role: 'user', text: userText }, { role: 'model', text: botText }]);
    setTurnSignals((prev) => [...prev, { hasAudio, hintUsed: usage.hintUsed, modelAnswerUsed: usage.modelAnswerUsed, turnScore }]);

    persistTurn('student', userText, usage.hintUsed, usage.modelAnswerUsed);
    persistTurn('bob', botText);

    pendingHintRef.current = false;
    pendingModelAnswerUsedRef.current = false;
    setPendingModelAnswer(null);
  };

  const handleSendText = async () => {
    if (!inputText.trim() || isProcessing) return;
    const text = inputText.trim();
    setInputText('');
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await chatTextConversationAction(text, messages, seed.topic, level);
      recordExchange(text, result.ai_response, result.evaluation.score, false);
    } catch (error) {
      console.error('[usePracticeTurn] handleSendText failed:', error);
      setErrorMessage('sendMessageError');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const base64Audio = await blobToBase64(blob);
      const mimeType = (blob.type || 'audio/webm').split(';')[0];
      const result = await chatConversationAction(base64Audio, mimeType, messages, seed.topic, level);
      recordExchange(result.evaluation.transcribed_text, result.ai_response, result.evaluation.score, true);
    } catch (error) {
      console.error('[usePracticeTurn] handleSendAudio failed:', error);
      setErrorMessage('conversationError');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestModelAnswer = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const suggestion = await simulateUserResponseAction(messages, seed.topic, level);
      pendingModelAnswerUsedRef.current = true;
      setPendingModelAnswer(suggestion);
    } catch (error) {
      console.error('[usePracticeTurn] handleRequestModelAnswer failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const dismissError = () => setErrorMessage(null);

  return {
    mode,
    framing,
    messages,
    turnSignals,
    playCounts,
    visibleTexts,
    isGeneratingAudio,
    isProcessing,
    errorMessage,
    pendingModelAnswer,
    imageUrl,
    imageLoading,
    inputText,
    setInputText,
    handleListen,
    handleToggleHint,
    handleSendText,
    handleSendAudio,
    handleRequestModelAnswer,
    dismissError,
  };
}
