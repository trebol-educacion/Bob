'use client';

/**
 * YLPart1Practice — Starters Part 1 (pointing) / Movers Part 1 (spot differences).
 *
 * Starters P1: 1 image with multiple objects. Examiner asks child to point/say where.
 * Movers  P1: 2 images with differences. Child describes each difference verbally.
 *
 * Props match YLPracticeBaseProps from design.md §3.3.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import {
  startYLSessionAction,
  generateYLImagesAction,
  evaluateYLTurnAction,
  saveYLTurnAction,
  evaluateYLFinalAction,
  getSessionMessagesAction,
} from '@/actions/modes/yl';
import type { YLExam, YLPlan } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import {
  RECORDING_MAX_SECONDS,
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
  | 'cue-ready'      // cue text visible, alumno decides cuando escuchar o hablar
  | 'playing-cue'    // TTS in flight
  | 'recording'      // alumno grabando
  | 'processing'     // upload + eval
  | 'reaction-ready' // reacción visible, alumno decide cuándo seguir
  | 'evaluating'     // eval final
  | 'finished';

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLPart1PracticeProps {
  exam: YLExam;
  part: 1;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: BobMessageShape[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YLPart1Practice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
}: YLPart1PracticeProps) {
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;

  // Read-only history mode
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
  const [messages, setMessages] = useState<BobMessageShape[]>(initialMessages ?? []);
  const [loadingStage, setLoadingStage] = useState<string>('Preparando tu práctica…');

  const recordedBlobRef = useRef<Blob | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnQAsRef = useRef<{ cue: string; transcript: string }[]>([]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
    },
  });

  // Cleanup
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
        setPlan(p);

        // Generate images if the plan provides image prompts
        if (p.image_prompts && p.image_prompts.length > 0) {
          const imgs = await generateYLImagesAction(
            exam,
            part,
            p.image_prompts,
            p.character_description
          );
          setImages(imgs);
        }

        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al preparar la sesión');
      }
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Turn orchestration ────────────────────────────────────────────────────

  const loadCue = useCallback(
    (idx: number) => {
      if (!plan) return;
      const cue = plan.cues[idx];
      if (!cue) return;
      setCurrentCue(cue);
      setPhase('cue-ready');
    },
    [plan]
  );

  // Show the first cue when ready (no auto-play, no auto-record)
  useEffect(() => {
    if (phase === 'ready' && plan) {
      loadCue(0);
    }
  }, [phase, plan, loadCue]);

  // User-driven actions
  const handlePlayCue = useCallback(async () => {
    if (!currentCue) return;
    setPhase('playing-cue');
    try {
      await playTTS(currentCue);
    } finally {
      setPhase('cue-ready');
    }
  }, [currentCue]);

  const handleStartRecording = useCallback(async () => {
    stopCurrentAudio();
    setPhase('recording');
    setRecordingSeconds(0);
    recordedBlobRef.current = null;
    await startRecording();

    let elapsed = 0;
    recordingTimerRef.current = setInterval(() => {
      elapsed += 1;
      setRecordingSeconds(elapsed);
      if (elapsed >= RECORDING_MAX_SECONDS) {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stopRecording();
      }
    }, 1000);
  }, [startRecording, stopRecording]);

  const handleStopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    stopRecording();
  }, [stopRecording]);

  const handlePlayReaction = useCallback(async () => {
    if (!currentReaction) return;
    await playTTS(currentReaction);
  }, [currentReaction]);

  const handleNextCue = useCallback(() => {
    stopCurrentAudio();
    const nextIndex = cueIndex + 1;
    if (!plan || nextIndex >= plan.cues.length) {
      setPhase('evaluating');
    } else {
      setCueIndex(nextIndex);
      loadCue(nextIndex);
    }
  }, [cueIndex, plan, loadCue]);

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

        // Save turn
        await saveYLTurnAction(sessionId!, {
          cue: currentCue,
          cueIndex,
          transcript: '',
          reaction: evalResult.reaction,
          evalResult,
        });

        turnQAsRef.current.push({ cue: currentCue, transcript: '' });

        setCurrentReaction(evalResult.reaction);
        setPhase('reaction-ready');

        // Play once automatically; alumno can replay or advance manually.
        void playTTS(evalResult.reaction);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error procesando respuesta');
      }
    })();
  }, [isRecording, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger final evaluation
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


  // ── Labels ────────────────────────────────────────────────────────────────

  const partLabel =
    exam === 'starters'
      ? 'Starters Part 1 — Señalar imágenes'
      : 'Movers Part 1 — Encuentra diferencias';

  const totalCues = plan?.cues.length ?? 1;
  const progress = Math.round(((cueIndex + (phase === 'reaction-ready' ? 1 : 0)) / totalCues) * 100);

  // ── Render: error ─────────────────────────────────────────────────────────

  if (error) {
    return <YLErrorScreen error={error} onBack={onBack} />;
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (phase === 'loading') {
    return <YLLoadingScreen message="Preparando tu práctica..." />;
  }

  // ── Render: evaluating ────────────────────────────────────────────────────

  if (phase === 'evaluating') {
    return <YLLoadingScreen message="Calculando tu puntuación final..." />;
  }

  // ── Render: finished — read-only history ──────────────────────────────────

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

  // ── Render: finished — results ────────────────────────────────────────────

  if (phase === 'finished' && finalEval) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6"
      >
        <YLResultsHeader title="¡Práctica completada!" subtitle={partLabel} />
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

  // ── Render: active practice ───────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <YLToolbar
        title={partLabel}
        subtitle={`Cue ${cueIndex + 1} de ${totalCues}`}
        onBack={onBack}
        progress={progress}
      />

      <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
        {/* Images */}
        {images.length > 0 && (
          <div
            className={`grid gap-3 ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} max-w-2xl mx-auto w-full`}
          >
            {images.map((src, i) => (
              <div key={i} className="rounded-2xl overflow-hidden shadow-md bg-white aspect-video relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${src}`}
                  alt={`Imagen ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Examiner cue + status */}
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
              {(phase === 'cue-ready' || phase === 'playing-cue') && (
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    type="button"
                    onClick={handlePlayCue}
                    disabled={phase === 'playing-cue'}
                    className="px-5 py-3 rounded-full bg-trebol-secondary/20 text-trebol-text font-bold text-sm hover:bg-trebol-secondary/40 transition-colors disabled:opacity-50"
                  >
                    {phase === 'playing-cue' ? 'Reproduciendo…' : '🔁 Escuchar de nuevo'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={phase === 'playing-cue'}
                    className="px-5 py-3 rounded-full bg-trebol-primary text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    🎤 Empezar a hablar
                  </button>
                </div>
              )}

              {phase === 'recording' && (
                <YLRecordingButton
                  isRecording={isRecording}
                  onStop={handleStopRecording}
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

              {phase === 'reaction-ready' && currentReaction && (
                <div className="flex flex-col items-center gap-4">
                  <YLReactionCard reaction={currentReaction} />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handlePlayReaction}
                      className="px-5 py-3 rounded-full bg-trebol-secondary/20 text-trebol-text font-bold text-sm hover:bg-trebol-secondary/40 transition-colors"
                    >
                      🔁 Escuchar de nuevo
                    </button>
                    <button
                      type="button"
                      onClick={handleNextCue}
                      className="px-5 py-3 rounded-full bg-trebol-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      ⏭️ Siguiente pregunta
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
