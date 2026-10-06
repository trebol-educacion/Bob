'use client';

import { useState, useRef, useCallback } from 'react';
import { blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTTS } from '@/hooks/useTTS';
import type { StoredMessage } from '@/actions/messages';
import { restoreCollaborative } from '@/lib/speaking/collaborative-restore';
import type { FormativeFeedback } from '@/lib/types/practice';
import type { Part3ChatMessage, Part3Scenario } from '@/lib/speaking/types';
import type { CollaborativePhase, CollaborativePracticeConfig, CollaborativeSessionParams } from './types';

export function useCollaborativeSession(config: CollaborativePracticeConfig, params: CollaborativeSessionParams = {}) {
  const { sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished } = params;
  const { actions } = config;
  const [restored] = useState(() =>
    initialSessionId && initialMessages && initialMessages.length > 0
      ? restoreCollaborative(initialMessages as StoredMessage[])
      : null,
  );
  const [phase, setPhase] = useState<CollaborativePhase>(() => {
    if (restored?.feedback) return 'result';
    return restored && restored.history.length > 0 ? 'conversation' : 'intro';
  });
  const [scenario, setScenario] = useState<Part3Scenario | null>(restored?.scenario ?? null);
  const [history, setHistory] = useState<Part3ChatMessage[]>(restored?.history ?? []);
  const [discussedOptions, setDiscussedOptions] = useState<Set<number>>(new Set());
  const [evaluation, setEvaluation] = useState<FormativeFeedback | null>(restored?.feedback ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);

  const adoptSession = useCallback((sessionId: string | undefined) => {
    if (!sessionId || sessionIdRef.current === sessionId) return;
    sessionIdRef.current = sessionId;
    onSessionCreated?.(sessionId);
  }, [onSessionCreated]);

  const userTurns = history.filter((m) => m.role === 'user').length;

  const { start: startTTS } = useTTS();

  const playExaminerTts = useCallback(async (text: string) => {
    try {
      setTtsLoading(true);
      await startTTS(text);
    } catch {
      return;
    } finally {
      setTtsLoading(false);
    }
  }, [startTTS]);

  const handleSurpriseMe = useCallback(async () => {
    setLoadingScenario(true);
    try {
      const generated = await actions.generateScenario();
      setScenario(generated);
    } catch {
      const random = config.presets[Math.floor(Math.random() * config.presets.length)];
      setScenario(random);
    } finally {
      setLoadingScenario(false);
    }
  }, [actions, config.presets]);

  const handleStart = useCallback(async () => {
    if (!scenario) return;

    setPhase('conversation');

    const openingLine = `Let's talk about "${scenario.topic}". ${scenario.situation} ${scenario.prompt_question}`;
    setHistory([{ role: 'examiner', text: openingLine }]);
    await playExaminerTts(openingLine);
  }, [scenario, playExaminerTts]);

  const processAudioBlob = useCallback(
    async (blob: Blob) => {
      if (!scenario) return;

      setIsProcessing(true);
      setAudioError(null);

      try {
        const base64 = await blobToBase64(blob);
        const mimeType = 'audio/webm;codecs=opus';

        const turn = await actions.chatAudio(base64, mimeType, history, scenario, sessionIdRef.current ?? undefined);
        if (!turn.ok) throw new Error(turn.code);
        const { transcribed, examinerResponse } = turn.data;
        adoptSession(turn.data.sessionId);

        const userMsg: Part3ChatMessage = { role: 'user', text: transcribed };
        const examinerMsg: Part3ChatMessage = { role: 'examiner', text: examinerResponse };

        setHistory((prev) => [...prev, userMsg, examinerMsg]);

        scenario.options.forEach((option, index) => {
          if (
            transcribed.toLowerCase().includes(option.toLowerCase().split(' ')[0]) ||
            examinerResponse.toLowerCase().includes(option.toLowerCase().split(' ')[0])
          ) {
            setDiscussedOptions((prev) => new Set([...prev, index]));
          }
        });

        await playExaminerTts(examinerResponse);
      } catch {
        setAudioError('Could not process audio. Please try again or use text input.');
      } finally {
        setIsProcessing(false);
      }
    },
    [scenario, history, playExaminerTts, actions, adoptSession]
  );

  const handleRecorderError = useCallback(() => {
    setAudioError('Microphone access denied. Use text input instead.');
  }, []);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: processAudioBlob,
    onError: handleRecorderError,
  });

  const handleTextSubmit = useCallback(async () => {
    if (!scenario || !textInput.trim()) return;

    const text = textInput.trim();
    setTextInput('');
    setShowTextInput(false);
    setIsProcessing(true);
    setAudioError(null);

    try {
      const userMsg: Part3ChatMessage = { role: 'user', text };
      const turn = await actions.chatText(text, history, scenario, sessionIdRef.current ?? undefined);
      if (!turn.ok) throw new Error(turn.code);
      const { examinerResponse } = turn.data;
      adoptSession(turn.data.sessionId);
      const examinerMsg: Part3ChatMessage = { role: 'examiner', text: examinerResponse };

      setHistory((prev) => [...prev, userMsg, examinerMsg]);
      await playExaminerTts(examinerResponse);
    } catch {
      setAudioError('Could not get examiner response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [scenario, textInput, history, playExaminerTts, actions, adoptSession]);

  const handleEvaluate = useCallback(async () => {
    if (!scenario) return;

    setPhase('evaluating');

    try {
      const result = await actions.evaluate(history, scenario, sessionIdRef.current ?? undefined);
      if (!result.ok) throw new Error(result.code);
      adoptSession(result.data.sessionId);
      setEvaluation(result.data.feedback);
      setPhase('result');
      onSessionFinished?.();
    } catch {
      setPhase('result');
      setEvaluation({
        kind: 'formative',
        understood: false,
        highlights: [],
        suggestions: ['Could not generate feedback. Please try again.'],
      });
    }
  }, [scenario, history, actions, adoptSession, onSessionFinished]);

  const handleTryAgain = useCallback(() => {
    setPhase('intro');
    setScenario(null);
    setHistory([]);
    setDiscussedOptions(new Set());
    setEvaluation(null);
    setIsProcessing(false);
    setAudioError(null);
    sessionIdRef.current = null;
  }, []);

  const toggleTextInput = useCallback(() => setShowTextInput((v) => !v), []);

  return {
    phase,
    scenario,
    history,
    discussedOptions,
    evaluation,
    isProcessing,
    loadingScenario,
    textInput,
    showTextInput,
    audioError,
    ttsLoading,
    userTurns,
    isRecording,
    startRecording,
    stopRecording,
    setTextInput,
    selectScenario: setScenario,
    toggleTextInput,
    handleSurpriseMe,
    handleStart,
    handleTextSubmit,
    handleEvaluate,
    handleTryAgain,
  };
}

export type CollaborativeSession = ReturnType<typeof useCollaborativeSession>;
