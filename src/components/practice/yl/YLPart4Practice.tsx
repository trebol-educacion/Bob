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
import { User } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import {
  startYLSessionAction,
  evaluateYLTurnAction,
  saveYLTurnAction,
  evaluateYLFinalAction,
} from '@/actions/modes/yl';
import type { YLExam, YLPlan } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import {
  RECORDING_MAX_SECONDS,
  REACTION_PAUSE_MS,
  playTTS,
  stopCurrentAudio,
  YLLoadingScreen,
  YLErrorScreen,
  YLToolbar,
  YLExaminerCard,
  YLRecordingButton,
  YLReactionCard,
  YLScoreDisplay,
  YLFeedbackCard,
  YLResultsHeader,
  YLReadOnlyMessage,
} from './_shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isReadOnly) return;

    async function init() {
      try {
        const { sessionId: sid, plan: p } = await startYLSessionAction({ mode });
        setSessionId(sid);
        onSessionCreated?.(sid);
        setPlan(p);
        // No images for personal questions
        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al preparar la sesión');
      }
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Turn orchestration ────────────────────────────────────────────────────

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

  // When recording stops → process
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

  // Final evaluation
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

  // ── Labels ────────────────────────────────────────────────────────────────

  const partLabel = (() => {
    if (exam === 'starters' && part === 4) return 'Starters Part 4 — Preguntas personales';
    if (exam === 'movers' && part === 4) return 'Movers Part 4 — Preguntas personales';
    if (exam === 'movers' && part === 5) return 'Movers Part 5 — Describe la imagen';
    return `Cambridge ${exam} Part ${part}`;
  })();

  const totalCues = plan?.cues.length ?? 1;
  const progress = Math.round(((cueIndex + (phase === 'reaction' ? 1 : 0)) / totalCues) * 100);

  // ── Renders ───────────────────────────────────────────────────────────────

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading') return <YLLoadingScreen message="Preparando tus preguntas..." />;
  if (phase === 'evaluating') return <YLLoadingScreen message="Calculando tu puntuación final..." />;

  if (phase === 'finished' && isReadOnly) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <YLToolbar title={partLabel} subtitle="Historial de práctica" onBack={onBack} progress={100} />
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <YLReadOnlyMessage
              key={msg.id}
              role={msg.role}
              text={(msg.content_text as string) ?? ''}
              msgType={msg.msg_type}
              contentJson={msg.content_json}
            />
          ))}
        </div>
      </div>
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
            className="flex-1 py-3 bg-trebol-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Volver a los modos
          </button>
        </div>
      </motion.div>
    );
  }

  // Active practice — no images, just a friendly avatar area
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <YLToolbar
        title={partLabel}
        subtitle={`Pregunta ${cueIndex + 1} de ${totalCues}`}
        onBack={onBack}
        progress={progress}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {/* Bob avatar placeholder */}
        <motion.div
          animate={phase === 'playing-cue' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-20 h-20 rounded-full bg-trebol-primary/10 flex items-center justify-center"
        >
          <User size={40} className="text-trebol-primary" />
        </motion.div>

        {/* Examiner cue */}
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

        {/* Status area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`status-${phase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 w-full"
          >
            {phase === 'playing-cue' && (
              <p className="text-trebol-text/50 font-semibold text-sm">
                Escucha la pregunta...
              </p>
            )}

            {phase === 'countdown' && (
              <div className="text-center space-y-1">
                <p className="text-trebol-text/60 font-semibold text-sm">Grabando en</p>
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
                <div className="w-8 h-8 border-3 border-trebol-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-trebol-text/50 font-semibold text-sm">
                  Procesando tu respuesta...
                </p>
              </div>
            )}

            {phase === 'reaction' && currentReaction && (
              <YLReactionCard reaction={currentReaction} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
