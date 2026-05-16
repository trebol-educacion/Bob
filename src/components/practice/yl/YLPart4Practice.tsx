'use client';

/**
 * YLPart4Practice — Personal questions. No images.
 *
 * Covers:
 *   - Starters Part 4: 4–5 simple personal questions (What's your name? How old are you?)
 *   - Movers   Part 4: 4–5 personal questions with more detail
 *   - Movers   Part 5: 5 personal questions A1 level (describe a picture verbally)
 *
 * `part` prop distinguishes prompt key used by the server action.
 * No images generated. Pure conversational turn loop.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ArrowLeft, Star } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
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

export interface YLPart4PracticeProps {
  exam: YLExam;
  /** 4 = Starters P4 / Movers P4; 5 = Movers P5 */
  part: 4 | 5;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: BobMessageShape[];
  onSessionCreated?: (sessionId: string) => void;
}

export function YLPart4Practice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
}: YLPart4PracticeProps) {
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
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
        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al preparar la sesión');
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
        setError(err instanceof Error ? err.message : 'Error procesando respuesta');
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
        setError(err instanceof Error ? err.message : 'Error en evaluación final');
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

  const partLabel = (() => {
    if (exam === 'starters' && part === 4) return 'Starters Part 4 — Preguntas personales';
    if (exam === 'movers' && part === 4) return 'Movers Part 4 — Preguntas personales';
    if (exam === 'movers' && part === 5) return 'Movers Part 5 — Describe la imagen';
    return `Cambridge ${exam} Part ${part}`;
  })();

  const headerTitle = (() => {
    if (exam === 'starters') return 'Starters — Personal';
    if (part === 5) return 'Movers — Describe';
    return 'Movers — Personal';
  })();
  const headerSubtitle = (() => {
    if (exam === 'starters') return 'Ages 6–8 · Part 4';
    if (part === 5) return 'Ages 7–9 · Part 5';
    return 'Ages 7–9 · Part 4';
  })();
  const partBadgeLabel = `PART ${part}`;

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
    <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-md">
      {partBadgeLabel}
    </span>
  );

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading') return <YLLoadingScreen message="Preparando tus preguntas..." />;
  if (phase === 'evaluating') return <YLLoadingScreen message="Calculating your final score…" />;

  if (phase === 'finished' && isReadOnly) {
    return (
      <ChatShell
        headerConfig={{ icon: Star, title: headerTitle, subtitle: 'Practice history', accentColor: 'amber', leftSlot: backButton, rightSlot: partBadge, online: false }}
        footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey={`yl-part${part}-readonly`}
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
        <YLResultsHeader title="¡Preguntas completadas!" subtitle={partLabel} />
        <YLScoreDisplay evalResult={finalEval} />
        <YLFeedbackCard feedback={finalEval.feedback} />
        <div className="flex gap-3 pb-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Back to activities
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
        className="h-full bg-blue-600"
      />
    </div>
  );

  return (
    <ChatShell
      headerConfig={{ icon: Star, title: headerTitle, subtitle: `${headerSubtitle} · Q ${cueIndex + 1}/${totalCues}`, accentColor: 'amber', leftSlot: backButton, rightSlot: <div className="flex items-center gap-2">{progressBar}{partBadge}</div>, online: true }}
      footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={null}
      animationKey={`yl-part${part}`}
    >
      <div className="flex flex-col items-center justify-center gap-6 py-4">
        <motion.div
          animate={phase === 'playing-cue' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-20 h-20 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center"
        >
          <User size={40} className="text-amber-600" />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`cue-${cueIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-sm"
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
                Escucha la pregunta...
              </p>
            )}

            {phase === 'countdown' && (
              <div className="text-center space-y-1">
                <p className="text-gray-500 font-semibold text-sm">Grabando en</p>
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-black text-blue-600 block"
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
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 font-semibold text-sm">
                  Processing your answer…
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
