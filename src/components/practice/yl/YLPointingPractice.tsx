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
import { ArrowLeft, MapPin } from 'lucide-react';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImageAction,
  saveYLTurnAction,
  persistYLImageAction,
  saveYLFinalEvalAction,
} from '@/actions/modes/yl';
import type { YLExam, YLPlan } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import { ChatShell } from '@/components/ChatShell';
import {
  playTTS,
  stopCurrentAudio,
  YLLoadingScreen,
  YLErrorScreen,
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
          const total = p.option_image_prompts.length;
          await Promise.all(
            p.option_image_prompts.map(async (prompt, i) => {
              const img = await generateYLImageAction(exam, part, prompt, i, total, sid);
              setImages((prev) => {
                const next = [...prev];
                next[i] = img;
                return next;
              });
              persistYLImageAction(sid, img, i).catch((err) =>
                console.warn('[YL] persist image', i, 'failed:', err)
              );
            })
          );
        }
        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error preparing the session');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopCurrentAudio(), []);

  const currentCue = plan?.pointing_cues?.[cueIndex];
  const totalCues = plan?.pointing_cues?.length ?? 4;

  // Note: cue audio auto-plays via the YLVoiceNote bubble itself (prop autoPlay)
  // so the user sees the playing state in the same UI that controls replay.

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
              ? 'Perfect! You identified all the objects.'
              : pct >= 50
              ? 'Good job! Next time try to get them all right.'
              : "Let's practice the vocabulary a little more.",
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
        setError(err instanceof Error ? err.message : 'Error finalizing the session');
      }
    })();
  }, [phase, sessionId, plan, score, mode]);

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading')
    return <YLLoadingScreen message="Getting your practice ready…" />;
  if (phase === 'evaluating')
    return <YLLoadingScreen message="Calculating your final score…" />;

  const partLabel = 'Starters Part 1 — Point to the picture';
  const progress = Math.round(((cueIndex + (phase === 'answered' ? 1 : 0)) / totalCues) * 100);

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
      POINTING
    </span>
  );

  const progressBar = (
    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4 }}
        className="h-full bg-blue-600"
      />
    </div>
  );

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
      <ChatShell
        headerConfig={{ icon: MapPin, title: 'Starters — Pointing', subtitle: 'Practice history', accentColor: 'amber', leftSlot: backButton, rightSlot: partBadge, online: false }}
        footerConfig={{ modeLabel: 'YL · POINTING', modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-pointing-readonly"
      >
        {messages
          // Exclude rows that are pure audio cache (yl_tts) or scene
          // images saved separately — they would duplicate the conversation.
          .filter((m) => m.msg_type !== 'evaluation' && m.msg_type !== 'yl_tts' && m.msg_type !== 'image_scene')
          .flatMap((m): React.ReactElement[] => {
            // For user_audio rows, the cue lives in content_json.cue.
            // Render the cue as a SEPARATE Bob bubble on the left BEFORE the
            // user's pick on the right, instead of inline as a label.
            if (m.role === 'user' && m.msg_type === 'user_audio') {
              const cue = (m.content_json as { cue?: string } | null)?.cue ?? '';
              const bubbles: React.ReactElement[] = [];
              if (cue) {
                bubbles.push(
                  <YLBobTextMessage key={`${m.id}-cue`} text={cue} />
                );
              }
              bubbles.push(
                <YLReadOnlyMessage
                  key={m.id}
                  role={m.role}
                  text={(m.content_text as string) ?? ''}
                  msgType={m.msg_type}
                />
              );
              return bubbles;
            }
            return [
              <YLReadOnlyMessage
                key={m.id}
                role={m.role}
                text={(m.content_text as string) ?? ''}
                msgType={m.msg_type}
                contentJson={m.content_json}
              />,
            ];
          })}
        {savedEval && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 max-w-md pt-2"
          >
            <YLResultsHeader title="Practice complete!" subtitle={partLabel} />
            <YLScoreDisplay evalResult={savedEval} />
            <YLFeedbackCard feedback={savedEval.feedback} />
          </motion.div>
        )}
      </ChatShell>
    );
  }


  const bottomBar = (
    <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-500 font-medium pl-2">
        {phase === 'ready' && '🎧 Listen and tap the correct picture'}
        {phase === 'answered' && (wasCorrect ? 'Well done!' : 'Almost… let\'s try the next one')}
        {phase === 'finished' && '✅ Practice complete'}
      </p>
      {phase === 'answered' && (
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-3 rounded-full bg-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
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
          className="px-6 py-3 rounded-full bg-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Back to activities
        </button>
      )}
    </div>
  );

  return (
    <ChatShell
      headerConfig={{ icon: MapPin, title: 'Starters — Pointing', subtitle: `Ages 6–8 · Round ${cueIndex + 1}/${totalCues}`, accentColor: 'amber', leftSlot: backButton, rightSlot: <div className="flex items-center gap-2">{progressBar}{partBadge}</div>, online: true }}
      footerConfig={{ modeLabel: 'YL · POINTING', modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={bottomBar}
      animationKey="yl-pointing"
    >
      {turns.map((t) => (
        <React.Fragment key={t.id}>
          <YLBobTextMessage text={t.cueText} />
          <YLUserTextMessage text={`👉 ${t.userPicked} ${t.correct ? '✓' : '✗'}`} />
          {sessionId && (
            <YLVoiceNote
              text={t.reactionText}
              side="bob"
              sessionId={sessionId}
              autoPlay={t.id === `turn-${cueIndex - 1}` || (phase === 'answered' && t.id === `turn-${cueIndex}`)}
            />
          )}
        </React.Fragment>
      ))}

      {currentCue && sessionId && phase === 'ready' && (
        <YLVoiceNote
          key={`cue-${cueIndex}`}
          text={currentCue.text}
          side="bob"
          sessionId={sessionId}
          autoPlay
        />
      )}

      {phase === 'finished' && finalEval && !isReadOnly && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 max-w-md"
        >
          <YLResultsHeader title="Practice complete!" subtitle={partLabel} />
          <YLScoreDisplay evalResult={finalEval} />
          <YLFeedbackCard feedback={finalEval.feedback} />
        </motion.div>
      )}

      {phase === 'ready' && plan?.options && images.length === plan.options.length && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
          {plan.options.map((label, idx) => (
            <button
              key={`${idx}-${label}`}
              type="button"
              onClick={() => handleSelect(idx)}
              className="group rounded-2xl bg-white shadow hover:shadow-lg overflow-hidden transition-all ring-2 ring-transparent hover:ring-blue-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[idx].startsWith('http') || images[idx].startsWith('data:') ? images[idx] : `data:image/png;base64,${images[idx]}`}
                alt={label}
                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform"
              />
            </button>
          ))}
        </div>
      )}
    </ChatShell>
  );
}
