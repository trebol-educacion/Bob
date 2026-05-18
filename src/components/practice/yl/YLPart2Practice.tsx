'use client';

/**
 * YLPart2Practice — Starters Part 2 (scene questions) / Movers Part 2 (info exchange).
 *
 * Starters P2: 1 contextual image. Bob asks simple scene questions. Child responds by audio.
 * Movers  P2: Info-exchange with 2 info cards. Bob asks target questions.
 *
 * Part always = 2. Exam prop distinguishes the sub-variant.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Headphones, Image as ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImagesAction,
  evaluateYLTurnAction,
  saveYLTurnAction,
  evaluateYLFinalAction,
} from '@/actions/modes/yl';
import type { YLExam, YLPlan } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import { ChatShell } from '@/components/ChatShell';
import {
  RECORDING_MAX_SECONDS,
  REACTION_PAUSE_MS,
  playTTS,
  stopCurrentAudio,
  YLLoadingScreen,
  YLErrorScreen,
  YLExaminerCard,
  YLRecordingButton,
  YLReactionCard,
  YLScoreDisplay,
  YLFeedbackCard,
  YLResultsHeader,
  YLReadOnlyMessage,
} from './_shared';

type Phase =
  | 'loading'
  | 'ready'
  | 'playing-cue'
  | 'countdown'
  | 'recording'
  | 'processing'
  | 'reaction'
  | 'evaluating'
  | 'finished';

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLPart2PracticeProps {
  exam: YLExam;
  part: 2;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: BobMessageShape[];
  onSessionCreated?: (sessionId: string) => void;
}

export function YLPart2Practice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
}: YLPart2PracticeProps) {
  const t = useTranslations('yl');
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [cueIndex, setCueIndex] = useState(0);
  const [currentCue, setCurrentCue] = useState('');
  const [currentReaction, setCurrentReaction] = useState('');
  const [countdown, setCountdown] = useState(2);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [finalEval, setFinalEval] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages] = useState<BobMessageShape[]>(initialMessages ?? []);

  const recordedBlobRef = useRef<Blob | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  }, []);

  useEffect(() => {
    if (isReadOnly) return;

    async function init() {
      try {
        const { sessionId: sid, plan: p } = await startYLSessionAction({ mode });
        setSessionId(sid);
        onSessionCreated?.(sid);
        setPlan(p);

        if (p.image_prompts && p.image_prompts.length > 0) {
          const imgs = await generateYLImagesAction(exam, part, p.image_prompts);
          setImages(imgs);
        }

        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error preparing the session');
      }
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runTurn = useCallback(
    async (idx: number) => {
      if (!plan) return;
      const cue = plan.cues[idx];
      if (!cue) return;

      setCurrentCue(cue);
      setPhase('playing-cue');
      await playTTS(cue);

      setPhase('countdown');
      await new Promise<void>((resolve) => {
        let c = 2;
        setCountdown(c);
        const t = setInterval(() => {
          c -= 1;
          setCountdown(c);
          if (c <= 0) {
            clearInterval(t);
            resolve();
          }
        }, 1000);
      });

      setPhase('recording');
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
    },
    [plan, startRecording, stopRecording]
  );

  useEffect(() => {
    if (phase === 'ready' && plan) {
      void runTurn(0);
    }
  }, [phase, plan, runTurn]);

  useEffect(() => {
    if (phase !== 'recording') return;
    if (isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    void (async () => {
      setPhase('processing');
      try {
        const blob = recordedBlobRef.current;
        let audioBase64 = '';
        let audioDuration = 0;

        if (blob && blob.size > 0) {
          audioBase64 = await blobToBase64(blob);
          audioDuration = recordingSeconds;
        }

        const evalResult = await evaluateYLTurnAction({
          mode,
          audioBase64,
          mimeType: 'audio/webm',
          audioDuration,
          cue: currentCue,
          sessionId: sessionId!,
          cueIndex,
        });

        await saveYLTurnAction(sessionId!, {
          cue: currentCue,
          cueIndex,
          transcript: '',
          reaction: evalResult.reaction,
          evalResult,
        });

        setCurrentReaction(evalResult.reaction);
        setPhase('reaction');

        await playTTS(evalResult.reaction);
        await new Promise<void>((r) => setTimeout(r, REACTION_PAUSE_MS));

        const nextIndex = cueIndex + 1;
        if (!plan || nextIndex >= plan.cues.length) {
          setPhase('evaluating');
        } else {
          setCueIndex(nextIndex);
          void runTurn(nextIndex);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error processing the answer');
      }
    })();
  }, [isRecording, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'evaluating' || !sessionId || !plan) return;

    void (async () => {
      try {
        const result = await evaluateYLFinalAction({
          sessionId,
          mode,
          turnsCount: plan.cues.length,
        });
        setFinalEval(result);
        setPhase('finished');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error in final evaluation');
      }
    })();
  }, [phase, sessionId, plan, mode]);

  const handleManualStop = useCallback(() => {
    if (isRecording) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const partLabel =
    exam === 'starters'
      ? t('part2.startersLabel')
      : t('part2.moversLabel');

  const headerIcon = exam === 'starters' ? Headphones : ImageIcon;
  const headerTitle = exam === 'starters' ? t('part2.startersHeaderTitle') : t('part2.moversHeaderTitle');
  const headerSubtitle = exam === 'starters' ? t('part2.startersHeaderSubtitle') : t('part2.moversHeaderSubtitle');
  const partBadgeLabel = 'PART 2';

  const totalCues = plan?.cues.length ?? 1;
  const progress = Math.round(((cueIndex + (phase === 'reaction' ? 1 : 0)) / totalCues) * 100);

  const backButton = (
    <button
      onClick={onBack}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="Back"
    >
      <ArrowLeft size={18} className="text-gray-600" />
    </button>
  );

  const partBadge = (
    <span
      className="text-xs font-bold text-bob-brand px-2 py-1 rounded-md"
      style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 10%, white)' }}
    >
      {partBadgeLabel}
    </span>
  );

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading') return <YLLoadingScreen message={t('common.gettingPracticeReady')} />;
  if (phase === 'evaluating') return <YLLoadingScreen message={t('common.calculatingFinalScore')} />;

  if (phase === 'finished' && isReadOnly) {
    return (
      <ChatShell
        headerConfig={{ icon: headerIcon, title: headerTitle, subtitle: t('common.practiceHistory'), accentColor: 'amber', leftSlot: backButton, rightSlot: partBadge, online: false }}
        footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-part2-readonly"
      >
        {messages.map((msg) => (
          <YLReadOnlyMessage
            key={msg.id}
            role={msg.role}
            text={(msg.content_text as string) ?? ''}
            msgType={msg.msg_type}
            contentJson={msg.content_json}
          />
        ))}
      </ChatShell>
    );
  }

  if (phase === 'finished' && finalEval) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6"
      >
        <YLResultsHeader title={t('common.practiceHistory')} subtitle={partLabel} />
        <YLScoreDisplay evalResult={finalEval} />
        <YLFeedbackCard feedback={finalEval.feedback} />

        {exam === 'movers' && plan?.student_card && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
            <h3 className="font-black text-gray-900">{t('part2.yourInfoCard')}</h3>
            {Object.entries(plan.student_card).map(([k, v]) => (
              <p key={k} className="text-sm text-gray-700">
                <span className="font-semibold">{k}:</span> {v}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-3 pb-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            {t('common.backToActivities')}
          </button>
        </div>
      </motion.div>
    );
  }

  const progressBar = (
    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4 }}
        className="h-full"
        style={{ background: 'var(--color-bob-brand)' }}
      />
    </div>
  );

  return (
    <ChatShell
      headerConfig={{ icon: headerIcon, title: headerTitle, subtitle: `${headerSubtitle} · Q ${cueIndex + 1}/${totalCues}`, accentColor: 'amber', leftSlot: backButton, rightSlot: <div className="flex items-center gap-2">{progressBar}{partBadge}</div>, online: true }}
      footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={null}
      animationKey="yl-part2"
    >
      {images.length > 0 && (
        <div className="max-w-lg mx-auto w-full rounded-2xl overflow-hidden shadow-md bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={(images[0]?.startsWith('data:') ? images[0] : `data:image/png;base64,${images[0] ?? ''}`)}
            alt={t('part2.sceneImage')}
            className="w-full object-cover"
          />
        </div>
      )}

      {exam === 'movers' && plan?.student_card && (
        <div
          className="max-w-lg mx-auto w-full rounded-xl p-4 space-y-1"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)',
            border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
          }}
        >
          <p className="text-xs font-bold text-bob-brand uppercase tracking-wide">{t('part2.yourCard')}</p>
          {Object.entries(plan.student_card).map(([k, v]) => (
            <p key={k} className="text-sm text-gray-700">
              <span className="font-semibold">{k}:</span> {v}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`cue-${cueIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full flex justify-center"
          >
            <YLExaminerCard cue={currentCue || '...'} />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={`status-${phase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 w-full"
          >
            {phase === 'playing-cue' && (
              <p className="text-gray-500 font-semibold text-sm">
                {t('part2.listeningToExaminer')}
              </p>
            )}

            {phase === 'countdown' && (
              <div className="text-center space-y-1">
                <p className="text-gray-500 font-semibold text-sm">{t('part2.recordingIn')}</p>
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

            {phase === 'recording' && (
              <YLRecordingButton
                isRecording={isRecording}
                onStop={handleManualStop}
                seconds={recordingSeconds}
                maxSeconds={RECORDING_MAX_SECONDS}
              />
            )}

            {phase === 'processing' && (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-bob-brand)', borderTopColor: 'transparent' }}
                />
                <p className="text-gray-500 font-semibold text-sm">
                  {t('common.processingAnswer')}
                </p>
              </div>
            )}

            {phase === 'reaction' && currentReaction && (
              <YLReactionCard reaction={currentReaction} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </ChatShell>
  );
}
