'use client';

/**
 * YLPointingPractice — Cambridge Starters Part 1 (Pointing).
 *
 * El alumno ESCUCHA una nota de voz ("Point to the doll") y CLICA la imagen
 * correcta entre 4 opciones. No hay grabación de audio: la interacción es
 * click-only.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  startYLSessionAction,
  generateYLImagesAction,
  saveYLTurnAction,
  persistYLImagesAction,
  saveYLFinalEvalAction,
} from '@/actions/modes/yl';
import type { YLExam, YLPlan } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import {
  playTTS,
  stopCurrentAudio,
  YLLoadingScreen,
  YLErrorScreen,
  YLToolbar,
  YLVoiceNote,
  YLBobTextMessage,
  YLUserTextMessage,
  YLScoreDisplay,
  YLFeedbackCard,
  YLResultsHeader,
  YLReadOnlyMessage,
} from './_shared';

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLPointingPracticeProps {
  exam: YLExam;
  part: 1;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: BobMessageShape[];
  onSessionCreated?: (sessionId: string) => void;
}

type Phase = 'loading' | 'ready' | 'answered' | 'evaluating' | 'finished';

export function YLPointingPractice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
}: YLPointingPracticeProps) {
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [cueIndex, setCueIndex] = useState(0);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finalEval, setFinalEval] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages] = useState<BobMessageShape[]>(initialMessages ?? []);
  // Conversation log shown in the chat below the click grid
  type TurnEntry = {
    id: string;
    cueText: string;
    userPicked: string;
    correct: boolean;
    reactionText: string;
  };
  const [turns, setTurns] = useState<TurnEntry[]>([]);

  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    if (initialSessionId || isReadOnly) {
      setPhase('finished');
      return;
    }
    (async () => {
      try {
        const { sessionId: sid, plan: p } = await startYLSessionAction({ mode });
        setSessionId(sid);
        onSessionCreated?.(sid);
        setPlan(p);
        if (p.option_image_prompts && p.option_image_prompts.length > 0) {
          const imgs = await generateYLImagesAction(exam, part, p.option_image_prompts);
          setImages(imgs);
          try {
            await persistYLImagesAction(sid, imgs);
          } catch (err) {
            console.warn('[YL] persist images failed (non-fatal):', err);
          }
        }
        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al preparar la sesión');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup audio on unmount
  useEffect(() => () => stopCurrentAudio(), []);

  const currentCue = plan?.pointing_cues?.[cueIndex];
  const totalCues = plan?.pointing_cues?.length ?? 4;

  // Speak the cue automatically when a new one is presented
  useEffect(() => {
    if (phase !== 'ready' || !currentCue) return;
    void playTTS(currentCue.text);
  }, [phase, currentCue]);

  const handleSelect = async (optionIdx: number) => {
    if (phase !== 'ready' || chosenIndex !== null || !currentCue || !sessionId) return;
    setChosenIndex(optionIdx);
    const correct = optionIdx === currentCue.target_index;
    setWasCorrect(correct);
    if (correct) setScore((s) => s + 1);
    setPhase('answered');

    const targetWord = plan?.options?.[currentCue.target_index] ?? 'item';
    const chosenWord = plan?.options?.[optionIdx] ?? 'item';
    const reactionText = correct
      ? `Excellent! That's the ${targetWord}. Well done!`
      : `Not quite. That's the ${chosenWord}. The ${targetWord} is over there. Try the next one!`;

    setTurns((prev) => [
      ...prev,
      {
        id: `turn-${cueIndex}`,
        cueText: currentCue.text,
        userPicked: chosenWord,
        correct,
        reactionText,
      },
    ]);

    // Speak the reaction in English
    void playTTS(reactionText);

    try {
      await saveYLTurnAction(sessionId, {
        cue: currentCue.text,
        cueIndex,
        transcript: chosenWord,
        reaction: reactionText,
      });
    } catch (err) {
      console.warn('[YLPointing] save turn failed:', err);
    }
  };

  const handleNext = () => {
    setChosenIndex(null);
    setWasCorrect(null);
    if (cueIndex + 1 >= totalCues) {
      setPhase('evaluating');
    } else {
      setCueIndex((i) => i + 1);
      setPhase('ready');
    }
  };

  // Final evaluation
  useEffect(() => {
    if (phase !== 'evaluating' || !sessionId || !plan) return;
    (async () => {
      try {
        const total = plan.pointing_cues?.length ?? 1;
        const pct = Math.round((score / total) * 100);
        const result: EvalResponse = {
          score: pct,
          score_max: 100,
          cefr_band: 'a1',
          feedback:
            pct === 100
              ? '¡Perfecto! Identificaste todos los objetos.'
              : pct >= 50
              ? '¡Buen trabajo! La próxima vez intenta acertar todos.'
              : 'Vamos a practicar un poquito más con el vocabulario.',
        };
        setFinalEval(result);
        // Persist final eval (click-based) directly — Gemini-based eval
        // doesn't make sense for a pointing activity.
        try {
          await saveYLFinalEvalAction(sessionId, result);
        } catch (err) {
          console.warn('[YLPointing] saveYLFinalEvalAction failed:', err);
        }
        setPhase('finished');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error finalizando la sesión');
      }
    })();
  }, [phase, sessionId, plan, score, mode]);

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading')
    return <YLLoadingScreen message="Preparando tu práctica…" />;
  if (phase === 'evaluating')
    return <YLLoadingScreen message="Calculando tu puntuación final…" />;

  const partLabel = 'Starters Part 1 — Señalar imágenes';
  const progress = Math.round(((cueIndex + (phase === 'answered' ? 1 : 0)) / totalCues) * 100);

  if (phase === 'finished' && isReadOnly) {
    // Find the saved final evaluation (if any) so we can render the
    // score / feedback cards inline below the conversation.
    const finalMsg = messages.find(
      (m) =>
        m.msg_type === 'evaluation' &&
        m.role === 'bob' &&
        (m.content_json as { is_final?: boolean } | null)?.is_final === true
    );
    const savedEval = (finalMsg?.content_json as EvalResponse | undefined) ?? null;

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <YLToolbar title={partLabel} subtitle="Historial de práctica" onBack={onBack} progress={100} />
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages
            .filter((m) => m.msg_type !== 'evaluation')
            .map((m) => (
              <YLReadOnlyMessage
                key={m.id}
                role={m.role}
                text={(m.content_text as string) ?? ''}
                msgType={m.msg_type}
                contentJson={m.content_json}
              />
            ))}
          {savedEval && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 max-w-md pt-2"
            >
              <YLResultsHeader title="¡Práctica completada!" subtitle={partLabel} />
              <YLScoreDisplay evalResult={savedEval} />
              <YLFeedbackCard feedback={savedEval.feedback} />
            </motion.div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col min-h-0">
      <YLToolbar
        title={partLabel}
        subtitle={`Ronda ${cueIndex + 1} de ${totalCues}`}
        onBack={onBack}
        progress={progress}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-6">
        <div className="w-full space-y-3">
          {/* Conversation log for previously answered rounds */}
          {turns.map((t) => (
            <React.Fragment key={t.id}>
              {/* Bob asks (voice + text via voice-note rendering can be added here if needed) */}
              <YLBobTextMessage text={t.cueText} />
              {/* User's pick */}
              <YLUserTextMessage text={`👉 ${t.userPicked} ${t.correct ? '✓' : '✗'}`} />
              {/* Bob's reaction: text + voice note */}
              <YLBobTextMessage text={t.reactionText} />
              {sessionId && (
                <YLVoiceNote text={t.reactionText} side="bob" sessionId={sessionId} />
              )}
            </React.Fragment>
          ))}

          {/* Current cue (voice only, NO text) */}
          {currentCue && sessionId && phase === 'ready' && (
            <YLVoiceNote text={currentCue.text} side="bob" sessionId={sessionId} />
          )}

          {/* Final results inline in chat */}
          {phase === 'finished' && finalEval && !isReadOnly && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 max-w-md"
            >
              <YLResultsHeader title="¡Práctica completada!" subtitle={partLabel} />
              <YLScoreDisplay evalResult={finalEval} />
              <YLFeedbackCard feedback={finalEval.feedback} />
            </motion.div>
          )}

          {/* 4-option grid (only while waiting for an answer) */}
          {phase === 'ready' && plan?.options && images.length === plan.options.length && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
              {plan.options.map((label, idx) => (
                <button
                  key={`${idx}-${label}`}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className="group rounded-2xl bg-white shadow hover:shadow-lg overflow-hidden transition-all ring-2 ring-transparent hover:ring-trebol-secondary/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[idx].startsWith('data:') ? images[idx] : `data:image/png;base64,${images[idx]}`}
                    alt={label}
                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-trebol-border bg-white/90 backdrop-blur p-3 flex items-center justify-between gap-3">
        <p className="text-xs text-trebol-text/60 font-medium pl-2">
          {phase === 'ready' && '🎧 Escucha y haz clic en la imagen correcta'}
          {phase === 'answered' && (wasCorrect ? '¡Muy bien!' : 'Casi… vamos a la siguiente')}
          {phase === 'finished' && '✅ Práctica completada'}
        </p>
        {phase === 'answered' && (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-3 rounded-full bg-trebol-primary text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {cueIndex + 1 >= totalCues ? 'Ver resultados' : 'Siguiente'}
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6 4l12 8-12 8V4z" />
              <rect x="18" y="4" width="2" height="16" />
            </svg>
          </button>
        )}
        {phase === 'finished' && !isReadOnly && (
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-full bg-trebol-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Volver a los modos
          </button>
        )}
      </div>
    </div>
  );
}
