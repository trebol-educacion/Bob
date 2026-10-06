'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTTS } from '@/hooks/useTTS';
import type { FormativeFeedback } from '@/lib/types/practice';
import { restoreQuestionRound } from '@/lib/speaking/question-round-restore';
import type { SpeakingQA } from '@/lib/speaking/types';
import { RECORDING_MAX_SECONDS, REACTION_PAUSE_MS } from './speaking-theme';
import type { QuestionRoundConfig, QuestionRoundSessionParams, QuestionRoundStep } from './types';

const PLACEMENT_MESSAGE = 'Complete your level test first to unlock this activity.';
const SAVE_MESSAGE = 'We could not save your answer. Please try again.';

function describeFailure(code: string): string {
  return code === 'placement_required' ? PLACEMENT_MESSAGE : SAVE_MESSAGE;
}

export function useQuestionRound<TPlan>(config: QuestionRoundConfig<TPlan>, params: QuestionRoundSessionParams = {}) {
  const { sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished } = params;
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

  const sessionIdRef = useRef<string | undefined>(initialSessionId);
  const restoreAttemptedRef = useRef(false);
  const evaluationStartedRef = useRef(false);
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

  const adoptSession = useCallback((sessionId: string | undefined) => {
    if (!sessionId || sessionIdRef.current === sessionId) return;
    sessionIdRef.current = sessionId;
    onSessionCreated?.(sessionId);
  }, [onSessionCreated]);

  const startSession = useCallback(async () => {
    try {
      const sessionPlan = await config.actions.generate();
      setPlan(sessionPlan);
      setQuestions(config.toQuestions(sessionPlan));
      setStep('answer');
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [config]);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    if (initialSessionId) {
      const restored = initialMessages ? restoreQuestionRound(initialMessages, config.planSchema) : null;
      if (!restored) {
        setError('We could not reopen this session. Go back and start a new one.');
        return;
      }
      const restoredQuestions = config.toQuestions(restored.plan);
      setPlan(restored.plan);
      setQuestions(restoredQuestions);
      setQas(restored.qas);
      setQuestionIndex(Math.min(restored.qas.length, Math.max(restoredQuestions.length - 1, 0)));
      setEvaluation(restored.feedback);
      setEvaluating(!restored.feedback && restored.qas.length >= restoredQuestions.length);
      setReady(true);
      return;
    }
    void startSession();
  }, [initialSessionId, initialMessages, config, startSession]);

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
        if (!plan) throw new Error('Session not ready');
        const result = await actions.processAnswer(audioBase64, blob.type || 'audio/webm', currentQuestion, {
          sessionId: sessionIdRef.current,
          plan,
        });
        if (!result.ok) throw new Error(describeFailure(result.code));
        adoptSession(result.data.sessionId);
        transcribed = result.data.transcribed;
        reaction = result.data.reaction;
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
    if (!evaluating || evaluationStartedRef.current) return;
    evaluationStartedRef.current = true;
    void (async () => {
      try {
        if (!plan) throw new Error('Session not ready');
        const result = await actions.evaluate(qas, { sessionId: sessionIdRef.current, plan });
        if (!result.ok) throw new Error(describeFailure(result.code));
        adoptSession(result.data.sessionId);
        setEvaluation(result.data.feedback);
        onSessionFinished?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Evaluation failed');
      } finally {
        setEvaluating(false);
      }
    })();
  }, [evaluating, qas, actions, plan, adoptSession, onSessionFinished]);

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
    sessionIdRef.current = undefined;
    evaluationStartedRef.current = false;
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
