'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mic, Square, RotateCcw, ChevronRight, ClipboardList } from 'lucide-react';
import { CountdownTimer } from '@/components/CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import { useTTS } from '@/hooks/useTTS';
import {
  generateToeflInterviewAction,
  submitToeflAnswerAction,
  finishToeflInterviewAction,
} from '@/actions/modes/toefl_interview';
import { restoreInterview, type ToeflInterviewPlan } from '@/lib/toefl/interview';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { FormativeFeedbackCard } from '@/components/toefl/FormativeFeedbackCard';
import { InterviewSummary } from '@/components/toefl/InterviewSummary';
import { difficultyKey } from '@/components/toefl/difficulty-key';
import type { ActivityRenderProps } from '@/lib/routing';
import type { FormativeFeedback } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { InterviewProgressDots } from '@/components/toefl/InterviewProgressDots';
import { ChatShell } from '@/components/ChatShell';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
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

export function ToeflInterviewPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: ActivityRenderProps) {
  const t = useTranslations('toefl');
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore: restoreInterview }),
  );
  const restored = boot.kind === 'restore' ? boot.data : null;
  const [phase, setPhase] = useState<InterviewPhase>(restored ? (restored.finished ? 'finished' : 'intro') : 'loading');
  const [subPhase, setSubPhase] = useState<QuestionSubPhase>('reading');
  const [plan, setPlan] = useState<ToeflInterviewPlan | null>(restored?.plan ?? null);
  const [currentIndex, setCurrentIndex] = useState(restored && !restored.finished ? restored.evaluations.length : 0);
  const [evaluations, setEvaluations] = useState<FormativeFeedback[]>(restored?.evaluations ?? []);
  const [currentEval, setCurrentEval] = useState<FormativeFeedback | null>(null);
  const [error, setError] = useState<string | null>(boot.kind === 'restore-failed' ? t('interview.loadError') : null);
  const [loadKey, setLoadKey] = useState(0);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);

  const recordedBlobRef = useRef<Blob | null>(null);
  const { playUrl: playQuestionUrl, stop: stopTTS } = useTTS();
  const autoStartedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);

  const { startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
      setSubPhase('evaluating');
    },
    onError: (err) => {
      console.error('Recording error:', err);
      setError(t('common.micError'));
    },
  });

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

  useEffect(() => {
    if (boot.kind !== 'generate') return;
    let cancelled = false;
    async function load() {
      try {
        const interviewPlan = await generateToeflInterviewAction();
        if (cancelled) return;
        if (!interviewPlan.ok) {
          setLoadErrorCode(interviewPlan.code);
          return;
        }
        setPlan(interviewPlan.data);
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
  }, [boot.kind, loadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(() => {
    if (!plan) return;
    setPhase('question');
    setSubPhase('reading');
    autoStartedRef.current = false;
  }, [plan]);

  useEffect(() => {
    if (phase !== 'question' || subPhase !== 'reading') return;
    if (!plan) return;

    let cancelled = false;
    const question = plan.questions[currentIndex];

    async function playQuestion() {
      if (question.audio_url) {
        await playQuestionUrl(question.audio_url, {
          onStart: () => {
            if (!cancelled) setSubPhase('listening');
          },
        });
      }
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
    const activePlan = plan;

    async function evaluate() {
      try {
        const base64 = await blobToBase64(blob);
        const mimeType = blob.type || 'audio/webm;codecs=opus';
        const outcome = await submitToeflAnswerAction({
          plan: activePlan,
          questionIndex: currentIndex,
          audioBase64: base64,
          mimeType,
          durationMs: RECORD_SECONDS * 1000,
          sessionId: sessionIdRef.current ?? undefined,
        });
        if ('error' in outcome) throw new Error(outcome.error);
        if (!sessionIdRef.current) onSessionCreated?.(outcome.sessionId);
        sessionIdRef.current = outcome.sessionId;
        setCurrentEval(outcome.feedback);
        setEvaluations((prev) => [...prev, outcome.feedback]);
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
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void finishToeflInterviewAction(sessionId).then((outcome) => {
          if ('error' in outcome) setError(t('interview.evalError'));
          else onSessionFinished?.();
        });
      }
      setPhase('finished');
    } else {
      setCurrentIndex(next);
      setSubPhase('reading');
      autoStartedRef.current = false;
    }
  }, [currentIndex, plan, onSessionFinished, t]);

  const handleRestart = useCallback(() => {
    setPlan(null);
    setPhase('loading');
    setSubPhase('reading');
    setCurrentIndex(0);
    setEvaluations([]);
    setCurrentEval(null);
    setError(null);
    setLoadErrorCode(null);
    autoStartedRef.current = false;
    sessionIdRef.current = null;
    setLoadKey((key) => key + 1);
  }, []);

  if (loadErrorCode) return <ActivityLoadError code={loadErrorCode} onBack={onBack} />;

  const headerRightSlot = phase === 'question' && plan ? (
    <div className="flex items-center gap-3">
      <InterviewProgressDots total={plan.questions.length} current={currentIndex} />
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
        <InterviewSummary plan={plan} evaluations={evaluations} />
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
