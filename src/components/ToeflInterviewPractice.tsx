'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mic, Square, RotateCcw, ChevronRight, ClipboardList } from 'lucide-react';
import { CountdownTimer } from '@/components/CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64, pcmToWavBase64 } from '@/lib/audio';
import { generateSpeechAction } from '@/actions/gemini';
import { createSessionAction } from '@/actions/sessions';
import {
  generateToeflInterviewAction,
  evaluateToeflResponseAction,
  persistToeflPlanAction,
  persistToeflResponseAction,
  persistToeflQuestionEvaluationAction,
  persistToeflSessionSummaryAction,
  type ToeflInterviewPlan,
} from '@/actions/modes/toefl_interview';
import type { ToeflEvaluation } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';

type InterviewPhase =
  | 'loading'
  | 'intro'
  | 'question'
  | 'finished';

type QuestionSubPhase =
  | 'reading'
  | 'listening'
  | 'prep'
  | 'recording'
  | 'evaluating'
  | 'result-preview';

const PREP_SECONDS = 5;
const RECORD_SECONDS = 45;

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 2.5) return 'text-yellow-500';
  return 'text-red-500';
}

function scoreBg(score: number): string {
  if (score >= 4) return 'bg-green-50 border-green-200';
  if (score >= 2.5) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function scoreBand(score: number): string {
  if (score >= 4.5) return 'Advanced';
  if (score >= 3.5) return 'High Intermediate';
  if (score >= 2.5) return 'Intermediate';
  if (score >= 1.5) return 'Low Intermediate';
  return 'Beginner';
}

function difficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'Easy';
    case 2: return 'Medium';
    case 3: return 'Hard';
    case 4: return 'Very Hard';
    default: return '';
  }
}

function ProgressBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 4 ? 'bg-green-500' : value >= 2.5 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface ToeflInterviewPracticeProps {
  onBack: () => void;
}

export function ToeflInterviewPractice({ onBack }: ToeflInterviewPracticeProps) {
  const [phase, setPhase] = useState<InterviewPhase>('loading');
  const [subPhase, setSubPhase] = useState<QuestionSubPhase>('reading');
  const [plan, setPlan] = useState<ToeflInterviewPlan | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluations, setEvaluations] = useState<ToeflEvaluation[]>([]);
  const [currentEval, setCurrentEval] = useState<ToeflEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordedBlobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoStartedRef = useRef(false);
  const sessionCreatedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const prepCountdown = useCountdown({
    seconds: PREP_SECONDS,
    onComplete: useCallback(() => {
      setSubPhase('recording');
    }, []),
  });

  const recordCountdown = useCountdown({
    seconds: RECORD_SECONDS,
    onComplete: useCallback(() => {
      stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  });

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
      setSubPhase('evaluating');
    },
    onError: (err) => {
      console.error('Recording error:', err);
      setError('Microphone error. Please check permissions and try again.');
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const interviewPlan = await generateToeflInterviewAction();
        if (cancelled) return;
        setPlan(interviewPlan);
        setPhase('intro');
      } catch (err) {
        if (!cancelled) {
          console.error('Load error:', err);
          setError('Failed to load interview. Please try again.');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleStart = useCallback(async () => {
    if (!plan) return;
    if (!sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      const sessionResult = await createSessionAction({
        mode: 'toefl_interview',
        topic: plan.topic_id,
        title: `TOEFL Interview — ${plan.topic_name}`,
      });
      if (sessionResult.data) {
        sessionIdRef.current = sessionResult.data.id;
        userIdRef.current = sessionResult.data.user_id;
        persistToeflPlanAction(sessionResult.data.id, sessionResult.data.user_id, plan).catch(
          (err) => console.error('[ToeflInterview persist] plan fire-and-forget:', err)
        );
      }
    }
    setPhase('question');
    setSubPhase('reading');
    setCurrentIndex(0);
    autoStartedRef.current = false;
  }, [plan]);

  useEffect(() => {
    if (phase !== 'question' || subPhase !== 'reading') return;
    if (!plan) return;

    let cancelled = false;
    const question = plan.questions[currentIndex];

    async function playQuestion() {
      try {
        const tts = await generateSpeechAction(question.text);
        if (cancelled) return;
        const wavUrl = pcmToWavBase64(tts.data, tts.mimeType);
        const audio = new Audio(wavUrl);
        audioRef.current = audio;
        setSubPhase('listening');

        audio.onended = () => {
          if (!cancelled) setSubPhase('prep');
        };
        audio.onerror = () => {
          if (!cancelled) setSubPhase('prep');
        };
        audio.play().catch(() => {
          if (!cancelled) setSubPhase('prep');
        });
      } catch {
        if (!cancelled) setSubPhase('prep');
      }
    }

    playQuestion();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, subPhase, currentIndex]);

  useEffect(() => {
    if (phase !== 'question' || subPhase !== 'prep') return;
    prepCountdown.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, subPhase]);

  useEffect(() => {
    if (phase !== 'question' || subPhase !== 'recording') {
      autoStartedRef.current = false;
      return;
    }
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;

    startRecording().then(() => {
      recordCountdown.start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, subPhase]);

  useEffect(() => {
    if (phase !== 'question' || subPhase !== 'evaluating') return;
    if (!recordedBlobRef.current || !plan) return;

    const blob = recordedBlobRef.current;
    recordedBlobRef.current = null;
    const question = plan.questions[currentIndex];

    async function evaluate() {
      const durationMs = RECORD_SECONDS * 1000;
      try {
        const base64 = await blobToBase64(blob);
        const mimeType = blob.type || 'audio/webm;codecs=opus';
        const evaluation = await evaluateToeflResponseAction(question.text, base64, mimeType);
        setCurrentEval(evaluation);
        setEvaluations((prev) => {
          const next = [...prev, evaluation];
          if (sessionIdRef.current && userIdRef.current) {
            const sid = sessionIdRef.current;
            const uid = userIdRef.current;
            persistToeflResponseAction(sid, uid, currentIndex, evaluation.transcribed_text, durationMs).catch(
              (err) => console.error('[ToeflInterview persist] response:', err)
            );
            persistToeflQuestionEvaluationAction(sid, uid, currentIndex, evaluation).catch(
              (err) => console.error('[ToeflInterview persist] q-eval:', err)
            );
          }
          return next;
        });
        setSubPhase('result-preview');
      } catch (err) {
        console.error('Evaluation error:', err);
        const fallback: ToeflEvaluation = {
          score: 0,
          fluency: 0,
          vocabulary: 0,
          grammar: 0,
          feedback: 'Evaluation could not be completed.',
          transcribed_text: '',
        };
        setCurrentEval(fallback);
        setEvaluations((prev) => [...prev, fallback]);
        setSubPhase('result-preview');
      }
    }

    evaluate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, subPhase]);

  const handleStopRecording = useCallback(() => {
    recordCountdown.stop();
    stopRecording();
  }, [recordCountdown, stopRecording]);

  const handleNext = useCallback(() => {
    if (!plan) return;
    setCurrentEval(null);
    setError(null);
    const next = currentIndex + 1;
    if (next >= plan.questions.length) {
      setEvaluations((prev) => {
        if (sessionIdRef.current && userIdRef.current) {
          persistToeflSessionSummaryAction(sessionIdRef.current, userIdRef.current, prev).catch(
            (err) => console.error('[ToeflInterview persist] summary:', err)
          );
        }
        return prev;
      });
      setPhase('finished');
    } else {
      setCurrentIndex(next);
      setSubPhase('reading');
      autoStartedRef.current = false;
    }
  }, [currentIndex, plan]);

  const handleRestart = useCallback(() => {
    setPlan(null);
    setPhase('loading');
    setSubPhase('reading');
    setCurrentIndex(0);
    setEvaluations([]);
    setCurrentEval(null);
    setError(null);
    autoStartedRef.current = false;
    sessionCreatedRef.current = false;
    sessionIdRef.current = null;
    userIdRef.current = null;
  }, []);

  const avgScore = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length
    : 0;
  const avgFluency = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.fluency, 0) / evaluations.length
    : 0;
  const avgVocabulary = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.vocabulary, 0) / evaluations.length
    : 0;
  const avgGrammar = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.grammar, 0) / evaluations.length
    : 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto bg-trebol-bg">

      <div className="sticky top-0 z-10 bg-trebol-bg/90 backdrop-blur-sm border-b border-trebol-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-trebol-text/60 hover:text-trebol-text transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="h-4 w-px bg-trebol-border" />
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-trebol-primary" />
          <span className="text-sm font-black text-trebol-text">
            TOEFL Interview{plan ? ` — ${plan.topic_name}` : ''}
          </span>
        </div>
        {phase === 'question' && plan && (
          <span className="ml-auto text-xs font-bold text-trebol-text/50">
            Question {currentIndex + 1} of {plan.questions.length}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">

        {phase === 'loading' && (
          <>
            <BobMascotLoader message="Generating your interview session…" />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </>
        )}

        {phase === 'intro' && plan && (
          <div className="flex flex-col items-center gap-6 text-center w-full">
            <div className="bg-trebol-secondary/10 p-5 rounded-full">
              <ClipboardList size={48} className="text-trebol-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-trebol-text">{plan.topic_name}</h2>
              <p className="text-trebol-text/70 font-medium max-w-md">{plan.topic_context}</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-trebol-text/50 uppercase tracking-widest">
              <span>4 questions</span>
              <span>·</span>
              <span>45 seconds each</span>
              <span>·</span>
              <span>TOEFL iBT format</span>
            </div>
            <div className="bg-white rounded-xl border border-trebol-border p-4 w-full text-left space-y-2">
              {plan.questions.map((q, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-black text-trebol-primary w-5">{i + 1}</span>
                  <span className="text-xs font-bold text-trebol-text/40 uppercase tracking-wide">
                    {difficultyLabel(q.difficulty)}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleStart}
              className="bg-trebol-primary text-white font-black px-10 py-3 rounded-xl hover:opacity-90 transition-opacity text-lg"
            >
              Start Interview
            </button>
          </div>
        )}

        {phase === 'question' && plan && (
          <div className="flex flex-col items-center gap-6 w-full">

            <div className="flex gap-2">
              {plan.questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i < currentIndex
                      ? 'bg-trebol-primary'
                      : i === currentIndex
                        ? 'bg-trebol-primary/60 ring-2 ring-trebol-primary/30'
                        : 'bg-trebol-border'
                  }`}
                />
              ))}
            </div>

            <span className="text-xs font-bold uppercase tracking-widest text-trebol-text/40">
              {difficultyLabel(plan.questions[currentIndex].difficulty)}
            </span>

            <div className="bg-white rounded-2xl border border-trebol-border shadow-sm p-6 w-full text-center">
              <p className="text-xl font-black text-trebol-text leading-relaxed">
                {plan.questions[currentIndex].text}
              </p>
            </div>

            {(subPhase === 'reading' || subPhase === 'listening') && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-trebol-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-trebol-text/60 font-medium text-sm">
                  {subPhase === 'reading' ? 'Loading question…' : 'Listen carefully…'}
                </p>
              </div>
            )}

            {subPhase === 'prep' && (
              <div className="flex flex-col items-center gap-3">
                <CountdownTimer
                  seconds={PREP_SECONDS}
                  remaining={prepCountdown.remaining}
                  isRunning={prepCountdown.isRunning}
                  size={80}
                />
                <p className="text-trebol-text/60 font-medium text-sm">Prepare your answer…</p>
              </div>
            )}

            {subPhase === 'recording' && (
              <div className="flex flex-col items-center gap-4">
                <CountdownTimer
                  seconds={RECORD_SECONDS}
                  remaining={recordCountdown.remaining}
                  isRunning={recordCountdown.isRunning}
                  size={120}
                />
                <div className="flex items-center gap-2 text-red-500 font-bold text-sm animate-pulse">
                  <Mic size={16} />
                  Recording
                </div>
                <p className="text-trebol-text/50 text-xs">Answer clearly and completely</p>
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 bg-red-500 text-white font-black px-6 py-3 rounded-xl hover:bg-red-600 transition-colors"
                >
                  <Square size={16} />
                  Stop
                </button>
              </div>
            )}

            {subPhase === 'evaluating' && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-trebol-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-trebol-text/60 font-medium text-sm">Evaluating your response…</p>
              </div>
            )}

            {subPhase === 'result-preview' && currentEval && (
              <div className={`w-full rounded-2xl border p-5 space-y-4 ${scoreBg(currentEval.score)}`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-trebol-text">Your Score</span>
                  <span className={`text-3xl font-black ${scoreColor(currentEval.score)}`}>
                    {currentEval.score.toFixed(1)}<span className="text-lg font-bold text-trebol-text/40"> / 5</span>
                  </span>
                </div>

                {currentEval.transcribed_text && (
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-wide mb-1">You said</p>
                    <p className="text-sm text-trebol-text italic">"{currentEval.transcribed_text}"</p>
                  </div>
                )}

                <p className="text-sm text-trebol-text/80 leading-relaxed">{currentEval.feedback}</p>

                <div className="grid grid-cols-3 gap-3 text-xs font-bold text-trebol-text/60">
                  <div className="text-center">
                    <div className={`text-lg font-black ${scoreColor(currentEval.fluency)}`}>
                      {currentEval.fluency.toFixed(1)}
                    </div>
                    Fluency
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-black ${scoreColor(currentEval.vocabulary)}`}>
                      {currentEval.vocabulary.toFixed(1)}
                    </div>
                    Vocabulary
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-black ${scoreColor(currentEval.grammar)}`}>
                      {currentEval.grammar.toFixed(1)}
                    </div>
                    Grammar
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 bg-trebol-primary text-white font-black px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  {currentIndex + 1 < (plan?.questions.length ?? 0) ? (
                    <>Next Question <ChevronRight size={16} /></>
                  ) : (
                    <>See Results <ChevronRight size={16} /></>
                  )}
                </button>
              </div>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
          </div>
        )}

        {phase === 'finished' && plan && (
          <div className="flex flex-col gap-6 w-full">
            <div className="bg-white rounded-2xl border border-trebol-border shadow-sm p-6 text-center space-y-2">
              <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest">Overall Score</p>
              <div className={`text-6xl font-black ${scoreColor(avgScore)}`}>
                {avgScore.toFixed(1)}
                <span className="text-2xl font-bold text-trebol-text/30"> / 5.0</span>
              </div>
              <p className={`text-sm font-bold ${scoreColor(avgScore)}`}>{scoreBand(avgScore)}</p>
            </div>

            <div className="bg-white rounded-2xl border border-trebol-border shadow-sm p-5 space-y-4">
              <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest">Skill Breakdown</p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm font-bold mb-1">
                    <span className="text-trebol-text">Fluency</span>
                    <span className={scoreColor(avgFluency)}>{avgFluency.toFixed(1)} / 5</span>
                  </div>
                  <ProgressBar value={avgFluency} />
                </div>
                <div>
                  <div className="flex justify-between text-sm font-bold mb-1">
                    <span className="text-trebol-text">Vocabulary</span>
                    <span className={scoreColor(avgVocabulary)}>{avgVocabulary.toFixed(1)} / 5</span>
                  </div>
                  <ProgressBar value={avgVocabulary} />
                </div>
                <div>
                  <div className="flex justify-between text-sm font-bold mb-1">
                    <span className="text-trebol-text">Grammar</span>
                    <span className={scoreColor(avgGrammar)}>{avgGrammar.toFixed(1)} / 5</span>
                  </div>
                  <ProgressBar value={avgGrammar} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-trebol-border shadow-sm p-5 space-y-3">
              <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest">Question Breakdown</p>
              {plan.questions.map((q, i) => {
                const ev = evaluations[i];
                if (!ev) return null;
                return (
                  <div key={i} className={`rounded-xl border p-3 space-y-1 ${scoreBg(ev.score)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-trebol-text/50 mb-0.5">Q{i + 1} · {difficultyLabel(q.difficulty)}</p>
                        <p className="text-sm font-bold text-trebol-text leading-snug line-clamp-2">{q.text}</p>
                        <p className="text-xs text-trebol-text/60 mt-1 line-clamp-1">{ev.feedback}</p>
                      </div>
                      <span className={`text-2xl font-black shrink-0 ${scoreColor(ev.score)}`}>
                        {ev.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-trebol-primary text-trebol-primary font-black px-4 py-3 rounded-xl hover:bg-trebol-primary hover:text-white transition-colors"
              >
                <RotateCcw size={16} />
                Try Again
              </button>
              <button
                onClick={onBack}
                className="flex-1 flex items-center justify-center gap-2 bg-trebol-primary text-white font-black px-4 py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                <ArrowLeft size={16} />
                Back to Modes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
