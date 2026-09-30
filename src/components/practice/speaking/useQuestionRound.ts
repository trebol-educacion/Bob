'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createSessionAction } from '@/actions/sessions';
import { blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTTS } from '@/hooks/useTTS';
import type { FormativeFeedback } from '@/lib/types/practice';
import type { SpeakingQA } from '@/lib/speaking/types';
import { RECORDING_MAX_SECONDS, REACTION_PAUSE_MS } from './speaking-theme';
import type { QuestionRoundConfig, QuestionRoundStep } from './types';

export function useQuestionRound<TPlan>(config: QuestionRoundConfig<TPlan>) {
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<TPlan | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [step, setStep] = useState<QuestionRoundStep>('answer');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentReaction, setCurrentReaction] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [qas, setQas] = useState<SpeakingQA[]>([]);
  const [evaluation, setEvaluation] = useState<FormativeFeedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [hearingQuestion, setHearingQuestion] = useState(false);

  const sessionIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  const { start: startTTS, stop: stopTTS } = useTTS();
  const { actions } = config;

  const currentQuestion = questions[questionIndex] ?? '';

  const stopTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const releasePlayback = useCallback(() => {
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleRecorded = useCallback((blob: Blob) => {
    stopTimer();
    recordedBlobRef.current = blob;
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blob.size > 0 ? URL.createObjectURL(blob) : null;
    });
    setStep('review');
  }, [stopTimer]);

  const handleRecorderError = useCallback((err: Error) => {
    stopTimer();
    const denied = /denied|permission|notallowed|notfound|getusermedia/i.test(err.name + err.message);
    if (denied) {
      setMicDenied(true);
      return;
    }
    setError(err.message);
  }, [stopTimer]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: handleRecorded,
    onError: handleRecorderError,
  });

  useEffect(() => () => {
    stopTimer();
    releasePlayback();
  }, [stopTimer, releasePlayback]);

  const startSession = useCallback(async () => {
    try {
      const sessionResult = await createSessionAction({ mode: config.mode, title: config.sessionTitle });
      if (!sessionResult.data) throw new Error(sessionResult.error ?? 'Failed to create session');
      sessionIdRef.current = sessionResult.data.id;
      userIdRef.current = sessionResult.data.user_id;
      const sessionPlan = await config.actions.generate(sessionIdRef.current, userIdRef.current);
      setPlan(sessionPlan);
      setQuestions(config.toQuestions(sessionPlan));
      setStep('answer');
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [config]);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  const advanceToNext = useCallback(() => {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= questions.length) {
      setEvaluating(true);
      return;
    }
    setQuestionIndex(nextIndex);
    setCurrentReaction('');
    setStep('answer');
  }, [questionIndex, questions.length]);

  async function handleStartRecording() {
    if (!plan) return;
    stopTTS();
    setHearingQuestion(false);
    setError(null);
    setRecordingSeconds(0);
    recordedBlobRef.current = null;
    setStep('recording');
    await startRecording();
    let elapsed = 0;
    recordingTimerRef.current = setInterval(() => {
      elapsed += 1;
      setRecordingSeconds(elapsed);
      if (elapsed >= RECORDING_MAX_SECONDS) {
        stopTimer();
        stopRecording();
      }
    }, 1000);
  }

  function handleStopRecording() {
    stopTimer();
    stopRecording();
  }

  function handleRetry() {
    releasePlayback();
    recordedBlobRef.current = null;
    setError(null);
    setStep('answer');
  }

  async function handleHearQuestion() {
    if (hearingQuestion) {
      stopTTS();
      setHearingQuestion(false);
      return;
    }
    setHearingQuestion(true);
    await startTTS(currentQuestion);
  }

  async function handleSend() {
    const blob = recordedBlobRef.current;
    setStep('processing');
    try {
      let transcribed = '';
      let reaction = '';
      if (blob && blob.size > 0) {
        const audioBase64 = await blobToBase64(blob);
        const result = await actions.processAnswer(
          audioBase64,
          blob.type || 'audio/webm',
          currentQuestion,
          sessionIdRef.current,
          userIdRef.current,
        );
        transcribed = result.transcribed;
        reaction = result.reaction;
      }
      setQas((prev) => [...prev, { question: currentQuestion, answer: transcribed }]);
      setCurrentReaction(reaction);
      setStep('transition');
      if (reaction) void startTTS(reaction);
      await new Promise<void>((resolve) => setTimeout(resolve, reaction ? REACTION_PAUSE_MS : 350));
      advanceToNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing error');
      setStep('review');
    }
  }

  useEffect(() => {
    if (!evaluating) return;
    void (async () => {
      try {
        const result = await actions.evaluate(qas, sessionIdRef.current, userIdRef.current);
        setEvaluation(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Evaluation failed');
      } finally {
        setEvaluating(false);
      }
    })();
  }, [evaluating, qas, actions]);

  function handleTryAgain() {
    stopTTS();
    setReady(false);
    setPlan(null);
    setQuestions([]);
    setQuestionIndex(0);
    setStep('answer');
    setQas([]);
    setEvaluation(null);
    setEvaluating(false);
    setError(null);
    setMicDenied(false);
    setCurrentReaction('');
    releasePlayback();
    void startSession();
  }

  function dismissMicDenied() {
    setMicDenied(false);
    setStep('answer');
  }

  return {
    ready,
    plan,
    questions,
    questionIndex,
    step,
    recordingSeconds,
    currentReaction,
    playbackUrl,
    evaluation,
    evaluating,
    error,
    micDenied,
    hearingQuestion,
    currentQuestion,
    isRecordingNow: step === 'recording' && isRecording,
    handleStartRecording,
    handleStopRecording,
    handleRetry,
    handleHearQuestion,
    handleSend,
    handleTryAgain,
    dismissMicDenied,
  };
}
