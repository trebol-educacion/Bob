'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mic, Square, RotateCcw, ChevronRight, ClipboardList } from 'lucide-react';
import { CountdownTimer } from '@/components/CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import { useTTS } from '@/hooks/useTTS';
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
import type { FormativeFeedback } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, InfoCard } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';

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

function difficultyKey(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'easy';
    case 2: return 'medium';
    case 3: return 'hard';
    case 4: return 'veryHard';
    default: return '';
  }
}

function FormativeFeedbackCard({ feedback }: { feedback: FormativeFeedback }) {
  const t = useTranslations('toefl.interview.feedback');
  return (
    <div className="w-full space-y-3">
      <div className={`text-center py-2 px-4 rounded-xl font-bold text-sm ${feedback.understood ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {feedback.understood ? t('understood') : t('notUnderstood')}
      </div>
      {feedback.highlights.length > 0 && (
        <div className="bg-green-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest">{t('strengths')}</p>
          {feedback.highlights.map((h, i) => (
            <p key={i} className="text-sm text-green-800">✓ {h}</p>
          ))}
        </div>
      )}
      {feedback.suggestions.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{t('tips')}</p>
          {feedback.suggestions.map((s, i) => (
            <p key={i} className="text-sm text-amber-800">→ {s}</p>
          ))}
        </div>
      )}
      {feedback.model_answer && (
        <div
          className="rounded-xl p-3 space-y-1"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)' }}
        >
          <p className="text-xs font-bold text-bob-brand uppercase tracking-widest">{t('example')}</p>
          <p className="text-sm text-gray-800 italic">"{feedback.model_answer}"</p>
        </div>
      )}
    </div>
  );
}

interface ToeflInterviewPracticeProps {
  onBack: () => void;
}

export function ToeflInterviewPractice({ onBack }: ToeflInterviewPracticeProps) {
  const t = useTranslations('toefl');
  const [phase, setPhase] = useState<InterviewPhase>('loading');
  const [subPhase, setSubPhase] = useState<QuestionSubPhase>('reading');
  const [plan, setPlan] = useState<ToeflInterviewPlan | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluations, setEvaluations] = useState<FormativeFeedback[]>([]);
  const [currentEval, setCurrentEval] = useState<FormativeFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordedBlobRef = useRef<Blob | null>(null);
  const { play: playTTS, stop: stopTTS } = useTTS();
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
      setError(t('common.micError'));
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
          setError(t('interview.loadError'));
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
      await playTTS(question.text, {
        onStart: () => {
          if (!cancelled) setSubPhase('listening');
        },
      });
      if (!cancelled) setSubPhase('prep');
    }

    playQuestion();

    return () => {
      cancelled = true;
      stopTTS();
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
        const feedback = await evaluateToeflResponseAction(question.text, base64, mimeType);
        setCurrentEval(feedback);
        setEvaluations((prev) => {
          const next = [...prev, feedback];
          if (sessionIdRef.current && userIdRef.current) {
            const sid = sessionIdRef.current;
            const uid = userIdRef.current;
            persistToeflResponseAction(sid, uid, currentIndex, feedback.model_answer ?? '', durationMs).catch(
              (err) => console.error('[ToeflInterview persist] response:', err)
            );
            persistToeflQuestionEvaluationAction(sid, uid, currentIndex, feedback).catch(
              (err) => console.error('[ToeflInterview persist] q-eval:', err)
            );
          }
          return next;
        });
        setSubPhase('result-preview');
      } catch (err) {
        console.error('Evaluation error:', err);
        const fallback: FormativeFeedback = {
          kind: 'formative',
          understood: false,
          highlights: [],
          suggestions: [t('interview.evalError')],
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

  const allHighlights = evaluations.flatMap((e) => e.highlights);
  const allSuggestions = evaluations.flatMap((e) => e.suggestions);

  const progressDots = plan ? (
    <div className="flex gap-1.5">
      {plan.questions.map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{
            background:
              i < currentIndex
                ? 'var(--color-bob-brand)'
                : i === currentIndex
                  ? 'color-mix(in oklab, var(--color-bob-brand) 60%, white)'
                  : '#e5e7eb',
          }}
        />
      ))}
    </div>
  ) : null;

  const headerRightSlot = phase === 'question' && plan ? (
    <div className="flex items-center gap-3">
      {progressDots}
      <span className="text-xs font-bold text-gray-400">
        {currentIndex + 1}/{plan.questions.length}
      </span>
    </div>
  ) : null;

  const inputSlot = (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-3">
      {phase === 'question' && subPhase === 'recording' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-500 font-bold text-sm animate-pulse">
            <Mic size={16} />
            <span>{t('common.recording')}</span>
          </div>
          <button
            onClick={handleStopRecording}
            className="flex items-center gap-2 bg-red-500 text-white font-black px-5 py-2.5 rounded-xl hover:bg-red-600 transition-colors"
          >
            <Square size={15} />
            {t('interview.stop')}
          </button>
        </div>
      )}

      {phase === 'question' && subPhase === 'result-preview' && currentEval && (
        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-2 text-white font-black px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          {currentIndex + 1 < (plan?.questions.length ?? 0) ? (
            <>{t('interview.nextQuestion')} <ChevronRight size={16} /></>
          ) : (
            <>{t('common.seeResults')} <ChevronRight size={16} /></>
          )}
        </button>
      )}

      {phase === 'intro' && (
        <button
          onClick={handleStart}
          className="w-full text-white font-black px-8 py-3 rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          {t('interview.startButton')}
        </button>
      )}

      {phase === 'finished' && (
        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 flex items-center justify-center gap-2 border-2 text-bob-brand font-black px-4 py-2.5 rounded-xl transition-colors"
            style={{ borderColor: 'var(--color-bob-brand)' }}
          >
            <RotateCcw size={15} />
            {t('common.tryAgain')}
          </button>
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 text-white font-black px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            <ArrowLeft size={15} />
            {t('common.back')}
          </button>
        </div>
      )}
    </div>
  );

  const bodyContent = (
    <>
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <BobMascotLoader message={t('interview.loading')} />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>
      )}

      {phase === 'intro' && plan && (
        <div className="space-y-4 py-4">
          <MessageBubble variant="assistant" icon={ClipboardList} accentColor="blue">
            <p className="font-bold text-base">{plan.topic_name}</p>
            <p className="text-gray-500 text-sm mt-1">{plan.topic_context}</p>
          </MessageBubble>
          <InfoCard title={t('interview.formatCardTitle')} icon={ClipboardList}>
            <div className="space-y-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
                {t('interview.formatCardSubtitle')}
              </p>
              {plan.questions.map((q, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-black text-bob-brand w-4">{i + 1}</span>
                  <span className="text-xs font-bold text-amber-700/60 uppercase tracking-wide">
                    {t(`interview.difficulty.${difficultyKey(q.difficulty)}`)}
                  </span>
                </div>
              ))}
            </div>
          </InfoCard>
        </div>
      )}

      {phase === 'question' && plan && (
        <div className="space-y-4 py-2">
          <MessageBubble variant="assistant" icon={ClipboardList} accentColor="blue">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-bob-brand uppercase tracking-widest">
                {t(`interview.difficulty.${difficultyKey(plan.questions[currentIndex].difficulty)}`)}
              </p>
              <p className="text-base font-bold leading-snug">
                {plan.questions[currentIndex].text}
              </p>
            </div>
          </MessageBubble>

          {(subPhase === 'reading' || subPhase === 'listening') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div
                className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-bob-brand)', borderTopColor: 'transparent' }}
              />
              <p className="text-gray-400 font-medium text-sm">
                {subPhase === 'reading' ? t('interview.questionLoading') : t('interview.listenCarefully')}
              </p>
            </div>
          )}

          {subPhase === 'prep' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CountdownTimer
                seconds={PREP_SECONDS}
                remaining={prepCountdown.remaining}
                isRunning={prepCountdown.isRunning}
                size={80}
              />
              <p className="text-gray-400 font-medium text-sm">{t('interview.prepareAnswer')}</p>
            </div>
          )}

          {subPhase === 'recording' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CountdownTimer
                seconds={RECORD_SECONDS}
                remaining={recordCountdown.remaining}
                isRunning={recordCountdown.isRunning}
                size={120}
              />
              <p className="text-gray-400 text-xs">{t('interview.answerClearly')}</p>
            </div>
          )}

          {subPhase === 'evaluating' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div
                className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-bob-brand)', borderTopColor: 'transparent' }}
              />
              <p className="text-gray-400 font-medium text-sm">{t('interview.evaluating')}</p>
            </div>
          )}

          {subPhase === 'result-preview' && currentEval && (
            <FormativeFeedbackCard feedback={currentEval} />
          )}

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
        </div>
      )}

      {phase === 'finished' && plan && (
        <div className="space-y-4 py-2">
          <InfoCard title={t('interview.finished.sessionFeedback')} icon={ClipboardList}>
            <div className="space-y-3">
              {allHighlights.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-widest">{t('interview.finished.strengthsTitle')}</p>
                  {allHighlights.map((h, i) => (
                    <p key={i} className="text-sm text-green-800">✓ {h}</p>
                  ))}
                </div>
              )}
              {allSuggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{t('interview.finished.focusAreas')}</p>
                  {allSuggestions.map((s, i) => (
                    <p key={i} className="text-sm text-amber-800">→ {s}</p>
                  ))}
                </div>
              )}
            </div>
          </InfoCard>

          <div className="space-y-2">
            {plan.questions.map((q, i) => {
              const ev = evaluations[i];
              if (!ev) return null;
              return (
                <MessageBubble key={i} variant="assistant" icon={ClipboardList} accentColor="blue" noAnimate>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-bob-brand uppercase tracking-widest">
                      {t('interview.questionLabel', { n: i + 1, difficulty: t(`interview.difficulty.${difficultyKey(q.difficulty)}`) })}
                    </p>
                    <p className="text-sm font-bold leading-snug line-clamp-2">{q.text}</p>
                    <p className={`text-xs font-bold ${ev.understood ? 'text-green-600' : 'text-amber-600'}`}>
                      {ev.understood ? t('interview.finished.messageUnderstood') : t('interview.finished.needsPractice')}
                    </p>
                  </div>
                </MessageBubble>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: ClipboardList,
        title: plan ? t('interview.headerTitleWithTopic', { topic: plan.topic_name }) : t('interview.headerTitle'),
        subtitle: t('interview.headerSubtitle'),
        accentColor: 'blue',
        online: true,
        leftSlot: (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
          </button>
        ),
        rightSlot: headerRightSlot,
      }}
      footerConfig={{
        modeLabel: t('interview.footerMode'),
        modelName: ACTIVE_MODEL_LABEL,
      }}
      inputSlot={inputSlot}
      animationKey={`toefl-interview-${phase}`}
    >
      {bodyContent}
    </ChatShell>
  );
}
