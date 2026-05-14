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
  YLScoreDisplay,
  YLFeedbackCard,
  YLResultsHeader,
  YLReadOnlyMessage,
  YLVoiceNote,
  YLImageMessage,
  YLUserTextMessage,
  YLBobTextMessage,
  YLChatMicBar,
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

  // User-driven actions — audio playback is owned per-bubble by YLVoiceNote.

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

  // ── Render: active practice (chat-style) ─────────────────────────────────

  type ChatItem =
    | { kind: 'image'; id: string; src: string }
    | { kind: 'bob-text'; id: string; text: string }
    | { kind: 'bob-voice'; id: string; text: string }
    | { kind: 'user-text'; id: string; text: string }
    | { kind: 'reaction-text'; id: string; text: string }
    | { kind: 'reaction-voice'; id: string; text: string };

  const chatItems: ChatItem[] = [];
  images.forEach((src, i) => chatItems.push({ kind: 'image', id: `img-${i}`, src }));
  for (let i = 0; i <= cueIndex; i++) {
    if (plan?.cues[i]) {
      chatItems.push({ kind: 'bob-text', id: `cue-t-${i}`, text: plan.cues[i] });
      chatItems.push({ kind: 'bob-voice', id: `cue-v-${i}`, text: plan.cues[i] });
    }
    if (i < cueIndex) {
      const past = turnQAsRef.current[i];
      chatItems.push({ kind: 'user-text', id: `u-${i}`, text: past?.transcript || '' });
    }
  }
  if (phase === 'reaction-ready' && currentReaction) {
    chatItems.push({ kind: 'user-text', id: `u-curr`, text: '' });
    chatItems.push({ kind: 'reaction-text', id: `r-t-${cueIndex}`, text: currentReaction });
    chatItems.push({ kind: 'reaction-voice', id: `r-v-${cueIndex}`, text: currentReaction });
  }

  const canRecord = phase === 'cue-ready' || phase === 'playing-cue';
  const isProcessing = phase === 'processing';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <YLToolbar
        title={partLabel}
        subtitle={`Cue ${cueIndex + 1} de ${totalCues}`}
        onBack={onBack}
        progress={progress}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-6">
        <div className="w-full space-y-3">
          {chatItems.map((item) => {
            switch (item.kind) {
              case 'image':
                return <YLImageMessage key={item.id} src={item.src} />;
              case 'bob-text':
              case 'reaction-text':
                return <YLBobTextMessage key={item.id} text={item.text} />;
              case 'bob-voice':
              case 'reaction-voice':
                return <YLVoiceNote key={item.id} text={item.text} side="bob" />;
              case 'user-text':
                return <YLUserTextMessage key={item.id} text={item.text} />;
            }
          })}
          {isProcessing && (
            <div className="flex justify-start gap-2">
              <div className="w-8 h-8 rounded-full bg-trebol-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-trebol-primary mt-1">
                B
              </div>
              <div className="rounded-2xl px-4 py-3 bg-white border border-trebol-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-trebol-primary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-trebol-primary animate-bounce" style={{ animationDelay: '120ms' }} />
                <div className="w-2 h-2 rounded-full bg-trebol-primary animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {phase === 'reaction-ready' ? (
        <div className="border-t border-trebol-border bg-white/90 backdrop-blur p-3 flex items-center justify-center">
          <button
            type="button"
            onClick={handleNextCue}
            className="px-6 py-3 rounded-full bg-trebol-primary text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            Siguiente pregunta
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6 4l12 8-12 8V4z" />
              <rect x="18" y="4" width="2" height="16" />
            </svg>
          </button>
        </div>
      ) : (
        <YLChatMicBar
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          isRecording={phase === 'recording' && isRecording}
          seconds={recordingSeconds}
          maxSeconds={RECORDING_MAX_SECONDS}
          disabled={isProcessing}
          helperText={
            phase === 'playing-cue'
              ? 'Bob está hablando…'
              : isProcessing
              ? 'Procesando tu respuesta…'
              : 'Pulsa para responder con tu voz'
          }
        />
      )}
    </div>
  );
}
