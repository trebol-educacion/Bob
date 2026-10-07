'use client';

import { useEffect, useRef, useState } from 'react';
import {
  chatConversationAction,
  chatTextConversationAction,
  suggestStudentAnswerAction,
  generateSpeechAction,
} from '@/actions/gemini';
import type { ChatMessage } from '@/actions/gemini';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import { recordPracticeTurnAction } from '@/actions/practice/turn';
import { generatePracticeImageAction } from '@/actions/practice/image';
import { isHintAvailable, markAssistedTurn } from '@/lib/practice/scaffolding';
import { AUDIO_GENERATION_TIMEOUT_MS, playAudioSafely, withTimeout } from './audioPlayback';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export interface PendingTurn {
  text: string | null;
}

type FailedAction = { kind: 'audio'; blob: Blob } | { kind: 'text'; text: string };

export interface UsePracticeTurnArgs {
  sessionId: string | null;
  organizationId: string | null;
  initialImageUrl?: string | null;
  onSessionCreated?: (sessionId: string) => void;
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
  initialFraming: string;
  initialMessages: ChatMessage[];
  initialTurnSignals?: PracticeTurnSignal[];
}

export interface UsePracticeTurnReturn {
  sessionId: string | null;
  mode: PracticeActivityMode;
  framing: string;
  messages: ChatMessage[];
  turnSignals: PracticeTurnSignal[];
  playCounts: Record<number, number>;
  visibleTexts: Record<number, boolean>;
  isGeneratingAudio: number | null;
  isProcessing: boolean;
  pendingTurn: PendingTurn | null;
  isSlow: boolean;
  errorMessage: string | null;
  canRetry: boolean;
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
  retryLastTurn: () => void;
  dismissError: () => void;
}

/**
 * @param args UsePracticeTurnArgs
 */
const AUTOPLAY_DELAY_MS = 500;
const SLOW_TURN_MS = 6000;

export function usePracticeTurn(args: UsePracticeTurnArgs): UsePracticeTurnReturn {
  const {
    sessionId: initialSessionId,
    organizationId,
    initialImageUrl,
    onSessionCreated,
    mode,
    seed,
    initialFraming,
    initialMessages,
    initialTurnSignals,
    level,
  } = args;

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);

  const framing = initialFraming;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [turnSignals, setTurnSignals] = useState<PracticeTurnSignal[]>(initialTurnSignals ?? []);
  const [playCounts, setPlayCounts] = useState<Record<number, number>>({});
  const [visibleTexts, setVisibleTexts] = useState<Record<number, boolean>>({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<FailedAction | null>(null);
  const [pendingModelAnswer, setPendingModelAnswer] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [imageLoading, setImageLoading] = useState(mode === 'picture' && initialSessionId === null);
  const [inputText, setInputText] = useState('');

  const audioCacheRef = useRef<Map<number, string>>(new Map());
  const pendingHintRef = useRef(false);
  const pendingModelAnswerUsedRef = useRef(false);
  const autoplayedRef = useRef<Set<number>>(new Set(initialMessages.map((_message, index) => index)));

  const revealText = (index: number) => setVisibleTexts((prev) => ({ ...prev, [index]: true }));

  useEffect(() => {
    if (mode !== 'picture' || initialSessionId !== null) return;
    let cancelled = false;
    (async () => {
      const result = await generatePracticeImageAction(seed.topic);
      if (cancelled) return;
      setImageUrl(result.imageUrl);
      setImagePrompt(result.prompt);
      setImageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, initialSessionId, seed.topic]);

  useEffect(() => {
    const lastIndex = messages.length - 1;
    if (lastIndex < 0 || messages[lastIndex].role !== 'model') return;
    if (audioCacheRef.current.has(lastIndex)) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, mimeType } = await withTimeout(
          generateSpeechAction(messages[lastIndex].text),
          AUDIO_GENERATION_TIMEOUT_MS,
          'audio-generation-timeout'
        );
        if (cancelled || !data) return;
        audioCacheRef.current.set(lastIndex, pcmToWavBase64(data, mimeType));
      } catch (error) {
        console.warn('[usePracticeTurn] audio prefetch safeguard:', error instanceof Error ? error.message : error);
      }
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
      const played = await playAudioSafely(cached);
      if (!played) revealText(index);
      return;
    }

    setIsGeneratingAudio(index);
    try {
      const { data, mimeType } = await withTimeout(
        generateSpeechAction(messages[index].text),
        AUDIO_GENERATION_TIMEOUT_MS,
        'audio-generation-timeout'
      );
      const audioUrl = pcmToWavBase64(data, mimeType);
      audioCacheRef.current.set(index, audioUrl);
      const played = await playAudioSafely(audioUrl);
      if (!played) revealText(index);
    } catch (error) {
      console.warn('[usePracticeTurn] audio generation safeguard:', error instanceof Error ? error.message : error);
      revealText(index);
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  useEffect(() => {
    if (mode !== 'conversation') return;
    const lastIndex = messages.length - 1;
    if (lastIndex < 0 || messages[lastIndex].role !== 'model') return;
    if (autoplayedRef.current.has(lastIndex)) return;
    autoplayedRef.current.add(lastIndex);
    const timer = setTimeout(() => {
      void handleListen(lastIndex);
    }, AUTOPLAY_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, messages]);

  const handleToggleHint = (index: number) => {
    if (!isHintAvailable(playCounts[index] ?? 0)) return;
    pendingHintRef.current = true;
    setVisibleTexts((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const recordExchange = async (userText: string, botText: string, turnScore: number | null, hasAudio: boolean): Promise<boolean> => {
    const usage = markAssistedTurn({
      hintUsed: pendingHintRef.current,
      modelAnswerUsed: pendingModelAnswerUsedRef.current,
    });
    const signal: PracticeTurnSignal = { hasAudio, hintUsed: usage.hintUsed, modelAnswerUsed: usage.modelAnswerUsed, turnScore };

    const recorded = await recordPracticeTurnAction({
      sessionId,
      mode,
      level,
      seed,
      organizationId,
      opening: { framing, message: initialMessages[0]?.text ?? '', imageUrl, imagePrompt },
      student: { text: userText, signal },
      botText,
    });
    if (!recorded.ok) return false;

    if (recorded.data.sessionId !== sessionId) {
      setSessionId(recorded.data.sessionId);
      onSessionCreated?.(recorded.data.sessionId);
    }

    setMessages((prev) => [...prev, { role: 'user', text: userText }, { role: 'model', text: botText }]);
    setTurnSignals((prev) => [...prev, signal]);

    pendingHintRef.current = false;
    pendingModelAnswerUsedRef.current = false;
    setPendingModelAnswer(null);
    return true;
  };

  const sendText = async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setPendingTurn({ text });
    const slowTimer = setTimeout(() => setIsSlow(true), SLOW_TURN_MS);
    try {
      const result = await chatTextConversationAction(text, messages, seed.topic, level);
      const persisted = await recordExchange(text, result.ai_response, result.evaluation.score, false);
      if (!persisted) {
        setErrorMessage('persistError');
        setLastFailedAction({ kind: 'text', text });
        return;
      }
      setLastFailedAction(null);
    } catch (error) {
      console.error('[usePracticeTurn] sendText failed:', error);
      setErrorMessage('sendMessageError');
      setLastFailedAction({ kind: 'text', text });
    } finally {
      clearTimeout(slowTimer);
      setIsSlow(false);
      setIsProcessing(false);
      setPendingTurn(null);
    }
  };

  const sendAudio = async (blob: Blob) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setPendingTurn({ text: null });
    const slowTimer = setTimeout(() => setIsSlow(true), SLOW_TURN_MS);
    try {
      const base64Audio = await blobToBase64(blob);
      const mimeType = (blob.type || 'audio/webm').split(';')[0];
      const result = await chatConversationAction(base64Audio, mimeType, messages, seed.topic, level);
      const persisted = await recordExchange(result.evaluation.transcribed_text, result.ai_response, result.evaluation.score, true);
      if (!persisted) {
        setErrorMessage('persistError');
        setLastFailedAction({ kind: 'audio', blob });
        return;
      }
      setLastFailedAction(null);
    } catch (error) {
      console.error('[usePracticeTurn] sendAudio failed:', error);
      setErrorMessage('conversationError');
      setLastFailedAction({ kind: 'audio', blob });
    } finally {
      clearTimeout(slowTimer);
      setIsSlow(false);
      setIsProcessing(false);
      setPendingTurn(null);
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim() || isProcessing) return;
    const text = inputText.trim();
    setInputText('');
    await sendText(text);
  };

  const handleSendAudio = async (blob: Blob) => {
    await sendAudio(blob);
  };

  const retryLastTurn = () => {
    if (!lastFailedAction) {
      setErrorMessage(null);
      return;
    }
    const action = lastFailedAction;
    setErrorMessage(null);
    if (action.kind === 'audio') {
      void sendAudio(action.blob);
    } else {
      void sendText(action.text);
    }
  };

  const handleRequestModelAnswer = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const suggestion = await suggestStudentAnswerAction(messages, seed.topic, level);
      pendingModelAnswerUsedRef.current = true;
      setPendingModelAnswer(suggestion.answer);
    } catch (error) {
      console.error('[usePracticeTurn] handleRequestModelAnswer failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const dismissError = () => {
    setErrorMessage(null);
    setLastFailedAction(null);
  };

  return {
    sessionId,
    mode,
    framing,
    messages,
    turnSignals,
    playCounts,
    visibleTexts,
    isGeneratingAudio,
    isProcessing,
    pendingTurn,
    isSlow,
    errorMessage,
    canRetry: lastFailedAction !== null,
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
    retryLastTurn,
    dismissError,
  };
}
