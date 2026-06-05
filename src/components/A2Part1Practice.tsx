'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Mic, MicOff, CheckCircle, ChevronRight } from 'lucide-react';
import { generateSpeechAction } from '@/actions/gemini';
import { generateA2SessionAction, processA2AnswerAction, evaluateA2FinalAction } from '@/actions/modes/a2';
import { createSessionAction } from '@/actions/sessions';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { A2SessionPlan } from '@/actions/modes/a2';
import type { FormativeFeedback } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, InfoCard } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import { useTranslations } from 'next-intl';

type A2Phase =
  | 'loading'
  | 'phase1'
  | 'phase2-topic1'
  | 'phase2-topic2'
  | 'final-question'
  | 'evaluating'
  | 'finished';

type QuestionStep =
  | 'playing-question'
  | 'countdown'
  | 'recording'
  | 'processing'
  | 'reaction'
  | 'transition';

interface QA {
  question: string;
  answer: string;
}

interface PhaseTransition {
  label: string;
}

export interface A2Part1PracticeProps {
  onBack: () => void;
}

const RECORDING_MAX_SECONDS = 30;
const REACTION_PAUSE_MS = 1500;
const PHASE_TRANSITION_MS = 2000;

function FormativeFeedbackPanel({ feedback }: { feedback: FormativeFeedback }) {
  return (
    <div className="space-y-4">
      <div className={`text-center py-3 px-4 rounded-xl font-bold text-sm ${feedback.understood ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {feedback.understood ? '¡Great job — your message came through!' : 'Keep practising — you are on the right track!'}
      </div>
      {feedback.highlights.length > 0 && (
        <div className="bg-green-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest">What went well</p>
          <ul className="space-y-1">
            {feedback.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                <span className="mt-0.5 shrink-0">✓</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.suggestions.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Tips to improve</p>
          <ul className="space-y-1">
            {feedback.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-0.5 shrink-0">→</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.model_answer && (
        <div
          className="rounded-xl p-4 space-y-1"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)' }}
        >
          <p className="text-xs font-bold text-bob-brand uppercase tracking-widest">Example answer</p>
          <p className="text-sm text-gray-800 italic">"{feedback.model_answer}"</p>
        </div>
      )}
    </div>
  );
}

/** A2 Key Part 1 Speaking practice — Cambridge KET interview simulation. */
export function A2Part1Practice({ onBack }: A2Part1PracticeProps) {
  const t = useTranslations('cambridge');
  const [phase, setPhase] = useState<A2Phase>('loading');
  const [plan, setPlan] = useState<A2SessionPlan | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStep, setQuestionStep] = useState<QuestionStep>('playing-question');
  const [countdown, setCountdown] = useState(2);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentReaction, setCurrentReaction] = useState('');
  const [phaseTransition, setPhaseTransition] = useState<PhaseTransition | null>(null);
  const [qas, setQas] = useState<QA[]>([]);
  const [evaluation, setEvaluation] = useState<FormativeFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');

  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const getAllQuestions = useCallback((p: A2SessionPlan): string[] => {
    return [
      ...p.phase1_questions,
      ...p.topic1_questions,
      ...p.topic2_questions,
      p.final_question,
    ];
  }, []);

  const getPhaseForIndex = useCallback((idx: number): A2Phase => {
    if (idx < 3) return 'phase1';
    if (idx < 7) return 'phase2-topic1';
    if (idx < 10) return 'phase2-topic2';
    return 'final-question';
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  const playTTS = useCallback(async (text: string): Promise<void> => {
    stopCurrentAudio();
    try {
      const { data, mimeType } = await generateSpeechAction(text);
      const url = pcmToWavBase64(data, mimeType);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      currentAudioRef.current = null;
    } catch {
      // Non-fatal — continue even if TTS fails
    }
  }, [stopCurrentAudio]);

  const recordedBlobRef = useRef<Blob | null>(null);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
    },
  });

  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [stopCurrentAudio]);

  useEffect(() => {
    async function init() {
      try {
        const sessionResult = await createSessionAction({ mode: 'cambridge_ket_part1', title: 'A2 Speaking – Part 1' });
        if (!sessionResult.data) throw new Error(sessionResult.error ?? 'Failed to create session');
        sessionIdRef.current = sessionResult.data.id;
        userIdRef.current = sessionResult.data.user_id;
        const sessionPlan = await generateA2SessionAction(sessionIdRef.current, userIdRef.current);
        setPlan(sessionPlan);
        setPhase('phase1');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    }
    void init();
  }, []);

  useEffect(() => {
    if (!plan || phase === 'loading' || phase === 'evaluating' || phase === 'finished') return;

    const questions = getAllQuestions(plan);
    if (questionIndex >= questions.length) return;

    const question = questions[questionIndex];
    setCurrentQuestion(question);
    setQuestionStep('playing-question');

    void (async () => {
      await playTTS(question);

      setQuestionStep('countdown');
      setCountdown(2);

      await new Promise<void>((resolve) => {
        let c = 2;
        const t = setInterval(() => {
          c -= 1;
          setCountdown(c);
          if (c <= 0) {
            clearInterval(t);
            resolve();
          }
        }, 1000);
      });

      setQuestionStep('recording');
      setRecordingSeconds(0);
      recordedBlobRef.current = null;

      await startRecording();

      let elapsed = 0;
      recordingTimerRef.current = setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
        if (elapsed >= RECORDING_MAX_SECONDS) {
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          stopRecording();
        }
      }, 1000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, questionIndex, phase]);

  useEffect(() => {
    if (questionStep !== 'recording') return;
    if (isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    void (async () => {
      setQuestionStep('processing');

      try {
        const blob = recordedBlobRef.current;
        let transcribed = '';
        let reaction = "Thank you.";

        if (blob && blob.size > 0) {
          const audioBase64 = await blobToBase64(blob);
          const result = await processA2AnswerAction(audioBase64, 'audio/webm', currentQuestion, sessionIdRef.current, userIdRef.current);
          transcribed = result.transcribed;
          reaction = result.reaction;
        }

        setQas((prev) => [...prev, { question: currentQuestion, answer: transcribed }]);
        setCurrentReaction(reaction);
        setQuestionStep('reaction');

        await playTTS(reaction);

        await new Promise<void>((resolve) => setTimeout(resolve, REACTION_PAUSE_MS));

        setQuestionStep('transition');
        await advanceToNext();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Processing error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, questionStep]);

  const advanceToNext = useCallback(async () => {
    if (!plan) return;
    const questions = getAllQuestions(plan);
    const nextIndex = questionIndex + 1;

    if (nextIndex >= questions.length) {
      setPhase('evaluating');
      return;
    }

    const currentPhase = getPhaseForIndex(questionIndex);
    const nextPhase = getPhaseForIndex(nextIndex);

    if (currentPhase !== nextPhase) {
      let label = '';
      if (nextPhase === 'phase2-topic1') label = t('a2.part1.phase2Topic', { topic: plan.topic1 });
      else if (nextPhase === 'phase2-topic2') label = t('a2.part1.phase2Topic', { topic: plan.topic2 });
      else if (nextPhase === 'final-question') label = t('a2.part1.finalQuestion');

      if (label) {
        setPhaseTransition({ label });
        await new Promise<void>((resolve) => setTimeout(resolve, PHASE_TRANSITION_MS));
        setPhaseTransition(null);
      }
    }

    setQuestionIndex(nextIndex);
    setPhase(nextPhase);
  }, [plan, questionIndex, getAllQuestions, getPhaseForIndex]);

  useEffect(() => {
    if (phase !== 'evaluating') return;

    void (async () => {
      try {
        const result = await evaluateA2FinalAction(qas, sessionIdRef.current, userIdRef.current);
        setEvaluation(result);
        setPhase('finished');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Evaluation failed');
      }
    })();
  }, [phase, qas]);

  const handleManualStop = useCallback(() => {
    if (isRecording) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const handleTryAgain = useCallback(() => {
    setPlan(null);
    setPhase('loading');
    setQuestionIndex(0);
    setQas([]);
    setEvaluation(null);
    setError(null);
    setCurrentQuestion('');
    setCurrentReaction('');
    setPhaseTransition(null);

    void (async () => {
      try {
        const sessionResult = await createSessionAction({ mode: 'cambridge_ket_part1', title: 'A2 Speaking – Part 1' });
        if (!sessionResult.data) throw new Error(sessionResult.error ?? 'Failed to create session');
        sessionIdRef.current = sessionResult.data.id;
        userIdRef.current = sessionResult.data.user_id;
        const sessionPlan = await generateA2SessionAction(sessionIdRef.current, userIdRef.current);
        setPlan(sessionPlan);
        setPhase('phase1');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    })();
  }, []);

  const totalQuestions = 11;
  const progress = Math.round(((questionIndex + (questionStep === 'reaction' ? 1 : 0)) / totalQuestions) * 100);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <p className="text-red-500 font-semibold text-center">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={handleTryAgain}
            className="px-5 py-2 bg-trebol-primary text-white rounded-lg font-semibold"
          >
            {t('common.tryAgain')}
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2 bg-trebol-border text-trebol-text rounded-lg font-semibold"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return <BobMascotLoader message={t('a2.part1.preparingInterview')} />;
  }

  if (phase === 'evaluating') {
    return <BobMascotLoader message={t('common.evaluatingPerformance')} />;
  }

  const questionNumber = questionIndex + 1;

  const progressBar = (
    <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <motion.div
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4 }}
        className="h-full rounded-full"
        style={{ background: 'var(--color-bob-brand)' }}
      />
    </div>
  );

  const backButton = (
    <button
      onClick={onBack}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="Back"
    >
      <ArrowLeft size={18} className="text-gray-600" />
    </button>
  );

  if (phase === 'finished' && evaluation) {
    const finishedBody = (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-4"
      >
        <div className="text-center space-y-2 pt-2">
          <CheckCircle className="mx-auto text-bob-brand" size={48} />
          <h2 className="text-2xl font-black text-gray-900">{t('a2.part1.interviewComplete')}</h2>
          <p className="text-gray-400 font-medium">{t('a2.part1.subtitle')}</p>
        </div>

        <FormativeFeedbackPanel feedback={evaluation} />

        <div className="flex gap-3">
          <button
            onClick={handleTryAgain}
            className="flex-1 py-3 text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            {t('common.tryAgain')}
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            {t('common.backToModes')}
          </button>
        </div>
      </motion.div>
    );

    return (
      <ChatShell
        headerConfig={{
          icon: CheckCircle,
          title: t('a2.part1.headerTitle'),
          subtitle: t('a2.part1.interviewCompleteSubtitle'),
          accentColor: 'blue',
          leftSlot: backButton,
          online: false,
        }}
        footerConfig={{
          modeLabel: 'A2 KEY PART 1',
          modelName: ACTIVE_MODEL_LABEL,
        }}
        inputSlot={null}
        animationKey="a2part1-finished"
      >
        {finishedBody}
      </ChatShell>
    );
  }

  const inputSlot = (
    <div className="px-4 py-3 border-t border-gray-100 bg-white">
      {questionStep === 'recording' && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow"
            >
              <Mic size={18} className="text-white" />
            </motion.div>
            <div>
              <p className="text-sm font-bold text-red-500">{t('a2.part1.recording')}</p>
              <p className="text-xs text-gray-400">
                {recordingSeconds}s / {RECORDING_MAX_SECONDS}s
              </p>
            </div>
          </div>
          <button
            onClick={handleManualStop}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <MicOff size={16} />
            {t('common.stop')}
          </button>
        </div>
      )}
      {questionStep !== 'recording' && (
        <p className="text-xs text-center text-gray-400 py-1">
          {questionStep === 'playing-question' && t('a2.part1.listeningToExaminer')}
          {questionStep === 'countdown' && t('a2.part1.recordingIn', { countdown })}
          {questionStep === 'processing' && t('a2.part1.processingAnswer')}
          {questionStep === 'reaction' && t('a2.part1.examinerResponding')}
          {questionStep === 'transition' && t('a2.part1.nextQuestion')}
        </p>
      )}
    </div>
  );

  const bodyContent = (
    <>
      <AnimatePresence mode="wait">
        {phaseTransition && (
          <motion.div
            key="phase-banner"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-30"
          >
            <div
              className="text-white px-8 py-5 rounded-2xl shadow-lg text-center space-y-1"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              <ChevronRight className="mx-auto opacity-60" size={20} />
              <p className="text-xl font-black">{phaseTransition.label}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key={`question-${questionIndex}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
      >
        <MessageBubble variant="assistant" accentColor="blue">
          <p className="text-base font-bold leading-snug">
            {currentQuestion || '...'}
          </p>
        </MessageBubble>
      </motion.div>

      {questionStep === 'reaction' && currentReaction && (
        <motion.div
          key="reaction"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <InfoCard title="Examiner">
            <p className="italic">"{currentReaction}"</p>
          </InfoCard>
        </motion.div>
      )}

      {questionStep === 'countdown' && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-gray-400 font-semibold text-sm">{t('a2.part1.recordingCountdownLabel')}</p>
          <motion.span
            key={countdown}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-5xl font-black text-bob-brand block"
          >
            {countdown}
          </motion.span>
        </div>
      )}

      {questionStep === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-bob-brand)', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-400 font-semibold text-sm">{t('a2.part1.processingAnswer')}</p>
        </div>
      )}
    </>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: Mic,
        title: t('a2.part1.headerTitle'),
        subtitle: t('a2.part1.questionOf', { current: questionNumber, total: totalQuestions }),
        accentColor: 'blue',
        leftSlot: backButton,
        rightSlot: progressBar,
        online: true,
      }}
      footerConfig={{
        modeLabel: 'A2 KEY PART 1',
        modelName: ACTIVE_MODEL_LABEL,
      }}
      inputSlot={inputSlot}
      animationKey={`a2part1-${phase}`}
    >
      {bodyContent}
    </ChatShell>
  );
}
