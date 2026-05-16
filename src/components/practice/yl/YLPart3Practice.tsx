'use client';

/**
 * YLPart3Practice — Picture story.
 *
 * Starters P3: 4 story images. Bob asks child to narrate each image.
 *              Eval per turn (not final holistic). CHARACTER_DESCRIPTION passed for consistency.
 * Movers  P3: Same structure but A1-level narration expected.
 *
 * Key difference from Part1/2: evaluations are PER TURN (not saved for holistic at end).
 * Final eval is still computed but over all turns.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Image as ImageIcon } from 'lucide-react';
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
  | 'generating-images'
  | 'ready'
  | 'playing-cue'
  | 'countdown'
  | 'recording'
  | 'processing'
  | 'reaction'
  | 'evaluating'
  | 'finished';

interface TurnEval {
  imageIndex: number;
  evalResult: EvalResponse;
}

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLPart3PracticeProps {
  exam: YLExam;
  part: 3;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: BobMessageShape[];
  onSessionCreated?: (sessionId: string) => void;
}

export function YLPart3Practice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
}: YLPart3PracticeProps) {
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [currentCue, setCurrentCue] = useState('');
  const [currentReaction, setCurrentReaction] = useState('');
  const [countdown, setCountdown] = useState(2);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [turnEvals, setTurnEvals] = useState<TurnEval[]>([]);
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
          setPhase('generating-images');
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

  const getCueForImage = useCallback(
    (idx: number, p: YLPlan): string => {
      if (p.story_beats && p.story_beats[idx]) return p.story_beats[idx];
      if (p.cues[idx]) return p.cues[idx];
      return `Tell me about image ${idx + 1}.`;
    },
    []
  );

  const runTurn = useCallback(
    async (idx: number) => {
      if (!plan) return;
      const cue = getCueForImage(idx, plan);

      setCurrentImageIdx(idx);
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
    [plan, getCueForImage, startRecording, stopRecording]
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
          cueIndex: currentImageIdx,
        });

        await saveYLTurnAction(sessionId!, {
          cue: currentCue,
          cueIndex: currentImageIdx,
          transcript: '',
          reaction: evalResult.reaction,
          evalResult,
        });

        setTurnEvals((prev) => [...prev, { imageIndex: currentImageIdx, evalResult }]);

        setCurrentReaction(evalResult.reaction);
        setPhase('reaction');

        await playTTS(evalResult.reaction);
        await new Promise<void>((r) => setTimeout(r, REACTION_PAUSE_MS));

        const totalImages = plan?.image_prompts?.length ?? plan?.cues.length ?? 4;
        const nextIdx = currentImageIdx + 1;
        if (!plan || nextIdx >= totalImages) {
          setPhase('evaluating');
        } else {
          void runTurn(nextIdx);
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
          turnsCount: plan.image_prompts?.length ?? plan.cues.length,
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

  const partLabel =
    exam === 'starters'
      ? 'Starters Part 3 — Historia con imágenes'
      : 'Movers Part 3 — Cuenta la historia';

  const headerIcon = BookOpen;
  const headerTitle = exam === 'starters' ? 'Starters — Story' : 'Movers — Story';
  const headerSubtitle = exam === 'starters' ? 'Ages 6–8 · Part 3' : 'Ages 7–9 · Part 3';
  const partBadgeLabel = 'PART 3';

  const totalImages = plan?.image_prompts?.length ?? plan?.cues.length ?? 4;
  const progress = Math.round(
    ((currentImageIdx + (phase === 'reaction' ? 1 : 0)) / totalImages) * 100
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

  const partBadge = (
    <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-md">
      {partBadgeLabel}
    </span>
  );

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;

  if (phase === 'loading' || phase === 'generating-images') {
    return (
      <YLLoadingScreen
        message={
          phase === 'generating-images'
            ? 'Generando las imágenes de la historia...'
            : 'Getting your practice ready…'
        }
      />
    );
  }

  if (phase === 'evaluating') return <YLLoadingScreen message="Calculating your final score…" />;

  if (phase === 'finished' && isReadOnly) {
    return (
      <ChatShell
        headerConfig={{ icon: headerIcon, title: headerTitle, subtitle: 'Practice history', accentColor: 'amber', leftSlot: backButton, rightSlot: partBadge, online: false }}
        footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-part3-readonly"
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
    const avgScore =
      turnEvals.length > 0
        ? Math.round(turnEvals.reduce((s, e) => s + e.evalResult.score, 0) / turnEvals.length)
        : finalEval.score;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6"
      >
        <YLResultsHeader title="¡Historia completada!" subtitle={partLabel} />

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {images.map((src, i) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src.startsWith('data:') ? src : `data:image/png;base64,${src}`}
                  alt={`Escena ${i + 1}`}
                  className="w-full object-cover aspect-video"
                />
              </div>
            ))}
          </div>
        )}

        <YLScoreDisplay evalResult={{ ...finalEval, score: avgScore }} />
        <YLFeedbackCard feedback={finalEval.feedback} />

        {turnEvals.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-black text-gray-900">Score per picture</h3>
            {turnEvals.map((te, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Imagen {te.imageIndex + 1}</span>
                <span className="font-bold text-blue-600">
                  {te.evalResult.score} / {te.evalResult.score_max}
                </span>
              </div>
            ))}
          </div>
        )}

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

  const currentImage = images[currentImageIdx];

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
      headerConfig={{ icon: headerIcon, title: headerTitle, subtitle: `${headerSubtitle} · Img ${currentImageIdx + 1}/${totalImages}`, accentColor: 'amber', leftSlot: backButton, rightSlot: <div className="flex items-center gap-2">{progressBar}{partBadge}</div>, online: true }}
      footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={null}
      animationKey="yl-part3"
    >
      {plan?.story_title && (
        <p className="text-center text-sm font-bold text-amber-700/70">
          {plan.story_title}
        </p>
      )}

      {currentImage && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImageIdx}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-lg mx-auto w-full rounded-2xl overflow-hidden shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.startsWith('data:') ? currentImage : `data:image/png;base64,${currentImage}`}
              alt={`Escena ${currentImageIdx + 1}`}
              className="w-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
      )}

      {images.length > 1 && (
        <div className="flex gap-2 justify-center">
          {images.map((src, i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentImageIdx
                  ? 'border-blue-600'
                  : i < currentImageIdx
                  ? 'border-blue-300'
                  : 'border-transparent opacity-30'
              }`}
            >
              {i <= currentImageIdx && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src.startsWith('data:') ? src : `data:image/png;base64,${src}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`cue-${currentImageIdx}`}
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
                Escucha al examinador...
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
