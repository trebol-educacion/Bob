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
import type { CambridgeEvaluation } from '@/lib/types/practice';

type A2Phase =
  | 'loading'
  | 'phase1'
  | 'phase2-topic1'
  | 'phase2-topic2'
  | 'final-question'
  | 'evaluating'
  | 'finished';

type QuestionStep =
  | 'playing-question'  // TTS of question playing
  | 'countdown'         // "Recording in 2..."
  | 'recording'         // user is recording
  | 'processing'        // sending to AI
  | 'reaction'          // showing examiner reaction + TTS
  | 'transition';       // brief pause before next

interface QA {
  question: string;
  answer: string;
}

interface PhaseTransition {
  label: string;
}

interface A2Part1PracticeProps {
  onBack: () => void;
}

const RECORDING_MAX_SECONDS = 30;
const REACTION_PAUSE_MS = 1500;
const PHASE_TRANSITION_MS = 2000;

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-semibold text-trebol-text">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 bg-trebol-secondary/20 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-trebol-primary rounded-full"
        />
      </div>
    </div>
  );
}

function CefrBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    A1: 'bg-gray-100 text-gray-600',
    A2: 'bg-blue-100 text-blue-700',
    B1: 'bg-green-100 text-green-700',
    B2: 'bg-purple-100 text-purple-700',
    C1: 'bg-orange-100 text-orange-700',
    C2: 'bg-red-100 text-red-700',
  };
  const cls = colorMap[level.toUpperCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold ${cls}`}>
      {level.toUpperCase()}
    </span>
  );
}

export function A2Part1Practice({ onBack }: A2Part1PracticeProps) {
  const [phase, setPhase] = useState<A2Phase>('loading');
  const [plan, setPlan] = useState<A2SessionPlan | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0); // 0-10 (total 11 questions)
  const [questionStep, setQuestionStep] = useState<QuestionStep>('playing-question');
  const [countdown, setCountdown] = useState(2);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentReaction, setCurrentReaction] = useState('');
  const [phaseTransition, setPhaseTransition] = useState<PhaseTransition | null>(null);
  const [qas, setQas] = useState<QA[]>([]);
  const [evaluation, setEvaluation] = useState<CambridgeEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Build flat question list from plan
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

  // Audio recorder
  const recordedBlobRef = useRef<Blob | null>(null);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [stopCurrentAudio]);

  // Initialize: generate plan and create session
  useEffect(() => {
    async function init() {
      try {
        const [sessionPlan] = await Promise.all([
          generateA2SessionAction(),
          createSessionAction({ mode: 'cambridge_ket_part1', title: 'A2 Key Speaking – Part 1' }),
        ]);
        setPlan(sessionPlan);
        setPhase('phase1');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    }
    void init();
  }, []);

  // Orchestrate question flow when phase or index changes
  useEffect(() => {
    if (!plan || phase === 'loading' || phase === 'evaluating' || phase === 'finished') return;

    const questions = getAllQuestions(plan);
    if (questionIndex >= questions.length) return;

    const question = questions[questionIndex];
    setCurrentQuestion(question);
    setQuestionStep('playing-question');

    void (async () => {
      // 1. Play TTS of the question
      await playTTS(question);

      // 2. Countdown
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

      // 3. Start recording
      setQuestionStep('recording');
      setRecordingSeconds(0);
      recordedBlobRef.current = null;

      await startRecording();

      // Auto-stop at max
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

  // When recording stops, process the answer
  useEffect(() => {
    if (questionStep !== 'recording') return;
    if (isRecording) return; // still recording

    // Recording just stopped
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
          const result = await processA2AnswerAction(audioBase64, 'audio/webm', currentQuestion);
          transcribed = result.transcribed;
          reaction = result.reaction;
        }

        setQas((prev) => [...prev, { question: currentQuestion, answer: transcribed }]);
        setCurrentReaction(reaction);
        setQuestionStep('reaction');

        // Play reaction TTS
        await playTTS(reaction);

        // Pause before next
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
      // All done — evaluate
      setPhase('evaluating');
      return;
    }

    const currentPhase = getPhaseForIndex(questionIndex);
    const nextPhase = getPhaseForIndex(nextIndex);

    // Show phase transition banner when moving between phases
    if (currentPhase !== nextPhase) {
      let label = '';
      if (nextPhase === 'phase2-topic1') label = `Phase 2: Topic — ${plan.topic1}`;
      else if (nextPhase === 'phase2-topic2') label = `Phase 2: Topic — ${plan.topic2}`;
      else if (nextPhase === 'final-question') label = 'Final Question';

      if (label) {
        setPhaseTransition({ label });
        await new Promise<void>((resolve) => setTimeout(resolve, PHASE_TRANSITION_MS));
        setPhaseTransition(null);
      }
    }

    setQuestionIndex(nextIndex);
    setPhase(nextPhase);
  }, [plan, questionIndex, getAllQuestions, getPhaseForIndex]);

  // Trigger evaluation when phase is 'evaluating'
  useEffect(() => {
    if (phase !== 'evaluating') return;

    void (async () => {
      try {
        const result = await evaluateA2FinalAction(qas);
        setEvaluation(result);
        setPhase('finished');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Evaluation failed');
      }
    })();
  }, [phase, qas]);

  // Manual stop recording handler
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
        const sessionPlan = await generateA2SessionAction();
        setPlan(sessionPlan);
        setPhase('phase1');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    })();
  }, []);

  const totalQuestions = 11;
  const progress = Math.round(((questionIndex + (questionStep === 'reaction' ? 1 : 0)) / totalQuestions) * 100);

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <p className="text-red-500 font-semibold text-center">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={handleTryAgain}
            className="px-5 py-2 bg-trebol-primary text-white rounded-lg font-semibold"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2 bg-trebol-border text-trebol-text rounded-lg font-semibold"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-trebol-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-trebol-text/60 font-semibold">Preparing your A2 interview...</p>
      </div>
    );
  }

  if (phase === 'evaluating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-trebol-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-trebol-text/60 font-semibold">Evaluating your performance...</p>
      </div>
    );
  }

  if (phase === 'finished' && evaluation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <CheckCircle className="mx-auto text-trebol-primary" size={48} />
          <h2 className="text-2xl font-black text-trebol-text">Interview Complete!</h2>
          <p className="text-trebol-text/60 font-medium">A2 Key — Part 1 Speaking</p>
        </div>

        {/* Score */}
        <div className="bg-trebol-primary rounded-2xl p-6 text-center text-white space-y-1">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Overall Score</p>
          <p className="text-7xl font-black">{evaluation.score}</p>
          <p className="text-sm opacity-80">out of 100</p>
          {evaluation.cefr_level && (
            <div className="flex justify-center mt-2">
              <CefrBadge level={evaluation.cefr_level} />
            </div>
          )}
        </div>

        {/* Sub-scores */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-black text-trebol-text">Skill Breakdown</h3>
          <ScoreBar label="Grammar" value={evaluation.grammar} />
          <ScoreBar label="Vocabulary" value={evaluation.vocabulary} />
          <ScoreBar label="Fluency" value={evaluation.fluency} />
        </div>

        {/* Feedback */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
          <h3 className="font-black text-trebol-text">Examiner Feedback</h3>
          <p className="text-trebol-text/80 text-sm leading-relaxed">{evaluation.feedback}</p>
        </div>

        {/* Strengths */}
        {evaluation.strengths.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-black text-trebol-text text-green-700">Strengths</h3>
            <ul className="space-y-2">
              {evaluation.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-trebol-text/80">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for improvement */}
        {evaluation.areas_for_improvement.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-black text-trebol-text text-amber-700">Areas to Improve</h3>
            <ul className="space-y-2">
              {evaluation.areas_for_improvement.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-trebol-text/80">
                  <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={handleTryAgain}
            className="flex-1 py-3 bg-trebol-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-trebol-border text-trebol-text rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Back to Modes
          </button>
        </div>
      </motion.div>
    );
  }

  // ── INTERVIEW PHASE UI ────────────────────────────────────────────────────

  const questionNumber = questionIndex + 1;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-trebol-border bg-white shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-trebol-secondary/20 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-trebol-text" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-black text-trebol-text">A2 Key – Part 1 Interview</p>
          <p className="text-xs text-trebol-text/50 font-medium">
            Question {questionNumber} of {totalQuestions}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-trebol-border shrink-0">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
          className="h-full bg-trebol-primary"
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Phase transition banner */}
          {phaseTransition && (
            <motion.div
              key="phase-banner"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10"
            >
              <div className="bg-trebol-primary text-white px-8 py-5 rounded-2xl shadow-lg text-center space-y-1">
                <ChevronRight className="mx-auto opacity-60" size={20} />
                <p className="text-xl font-black">{phaseTransition.label}</p>
              </div>
            </motion.div>
          )}

          {/* Question card */}
          <motion.div
            key={`question-${questionIndex}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="w-full max-w-lg"
          >
            <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-trebol-primary bg-trebol-secondary/20 px-2 py-0.5 rounded-full">
                  Examiner
                </span>
              </div>
              <p className="text-xl font-black text-trebol-text leading-snug">
                {currentQuestion || '...'}
              </p>
            </div>
          </motion.div>

          {/* Status area */}
          <motion.div
            key={`status-${questionStep}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 w-full max-w-lg"
          >
            {questionStep === 'playing-question' && (
              <p className="text-trebol-text/50 font-semibold text-sm">Listening to examiner...</p>
            )}

            {questionStep === 'countdown' && (
              <div className="text-center space-y-2">
                <p className="text-trebol-text/60 font-semibold text-sm">Recording in</p>
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-black text-trebol-primary block"
                >
                  {countdown}
                </motion.span>
              </div>
            )}

            {questionStep === 'recording' && (
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Mic size={28} className="text-white" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-red-500">Recording</p>
                  <p className="text-xs text-trebol-text/40">
                    {recordingSeconds}s / {RECORDING_MAX_SECONDS}s
                  </p>
                </div>
                <button
                  onClick={handleManualStop}
                  className="flex items-center gap-2 px-4 py-2 bg-trebol-border rounded-lg text-sm font-semibold text-trebol-text hover:bg-trebol-secondary/30 transition-colors"
                >
                  <MicOff size={16} />
                  Stop Recording
                </button>
              </div>
            )}

            {questionStep === 'processing' && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-trebol-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-trebol-text/50 font-semibold text-sm">Processing your answer...</p>
              </div>
            )}

            {questionStep === 'reaction' && currentReaction && (
              <div className="bg-trebol-secondary/10 rounded-xl px-5 py-4 text-center max-w-sm">
                <p className="text-trebol-text font-semibold italic">"{currentReaction}"</p>
                <p className="text-xs text-trebol-text/40 mt-1">Examiner</p>
              </div>
            )}

            {(questionStep === 'transition') && (
              <p className="text-trebol-text/40 font-semibold text-sm">Next question...</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
