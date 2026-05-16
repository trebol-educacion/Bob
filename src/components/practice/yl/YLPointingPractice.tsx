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
import { ArrowLeft } from 'lucide-react';
import { ListenAndPointIcon } from '@/components/icons/ModeIcons';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImagesParallelAction,
  saveYLTurnAction,
  persistYLImagesAction,
  saveYLFinalEvalAction,
  getYLSessionPlanAction,
  pregenerateYLCueAudiosAction,
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
  onSessionFinished?: () => void;
}

type Phase = 'loading' | 'ready' | 'answered' | 'evaluating' | 'finished';

export function YLPointingPractice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
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

    if (initialSessionId) {
      (async () => {
        try {
          const restoredPlan = await getYLSessionPlanAction(initialSessionId);
          if (restoredPlan) setPlan(restoredPlan);

          const imgs = (initialMessages ?? [])
            .filter((m) => m.role === 'bob' && m.msg_type === 'image_scene')
            .sort((a, b) => {
              const ai = (a.content_json as { image_index?: number } | null)?.image_index ?? 0;
              const bi = (b.content_json as { image_index?: number } | null)?.image_index ?? 0;
              return ai - bi;
            })
            .map((m) => (m.content_json as { image_data_uri?: string } | null)?.image_data_uri)
            .filter((u): u is string => typeof u === 'string');
          if (imgs.length > 0) setImages(imgs);

          const userTurns = (initialMessages ?? [])
            .filter((m) => m.role === 'user' && m.msg_type === 'user_audio')
            .map((m) => {
              const cj = (m.content_json as Record<string, unknown> | null) ?? {};
              return {
                cueIndex: (cj.cue_index as number) ?? 0,
                cueText: (cj.cue as string) ?? '',
                chosenWord: (cj.transcribed as string) ?? (m.content_text as string) ?? '',
              };
            })
            .sort((a, b) => a.cueIndex - b.cueIndex);

          const bobReactions = (initialMessages ?? [])
            .filter((m) => m.role === 'bob' && m.msg_type === 'yl_cue')
            .map((m) => {
              const cj = (m.content_json as Record<string, unknown> | null) ?? {};
              return {
                cueIndex: (cj.cue_index as number) ?? 0,
                reaction: (cj.reaction as string) ?? (m.content_text as string) ?? '',
              };
            });
          const reactionByIndex = new Map<number, string>();
          for (const r of bobReactions) reactionByIndex.set(r.cueIndex, r.reaction);

          const rebuiltTurns: TurnEntry[] = userTurns.map((t) => {
            const targetIdx = restoredPlan?.pointing_cues?.[t.cueIndex]?.target_index;
            const targetWord =
              targetIdx !== undefined ? restoredPlan?.options?.[targetIdx] ?? '' : '';
            return {
              id: `turn-${t.cueIndex}`,
              cueText: t.cueText,
              userPicked: t.chosenWord,
              correct: !!targetWord && t.chosenWord === targetWord,
              reactionText: reactionByIndex.get(t.cueIndex) ?? '',
            };
          });
          setTurns(rebuiltTurns);
          setScore(rebuiltTurns.filter((t) => t.correct).length);

          const evalMsg = (initialMessages ?? []).find(
            (m) =>
              m.role === 'bob' &&
              m.msg_type === 'evaluation' &&
              (m.content_json as { is_final?: boolean } | null)?.is_final === true
          );
          const totalFromPlan = restoredPlan?.pointing_cues?.length ?? 4;
          const isComplete = !!evalMsg || rebuiltTurns.length >= totalFromPlan;

          if (isComplete) {
            if (evalMsg) {
              const ej = (evalMsg.content_json as Record<string, unknown> | null) ?? {};
              setFinalEval({
                score: (ej.score as number) ?? rebuiltTurns.filter((t) => t.correct).length,
                score_max: (ej.score_max as number) ?? totalFromPlan,
                cefr_band: (ej.cefr_band as 'a1') ?? 'a1',
                feedback: (ej.feedback as string) ?? 'Great work!',
              });
            }
            setPhase('finished');
          } else {
            setCueIndex(rebuiltTurns.length);
            setPhase('ready');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error restoring the session');
        }
      })();
      return;
    }

    if (isReadOnly) {
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
          const words = p.options ?? [];
          const items = p.option_image_prompts.map((scenePrompt, i) => ({
            word: words[i] ?? '',
            scenePrompt,
          }));
          const urls = await generateYLImagesParallelAction(
            exam,
            part,
            items,
            sid,
            p.character_description
          );
          setImages(urls);
          persistYLImagesAction(sid, urls).catch((err) =>
            console.warn('[YL] persist images failed:', err)
          );
        }

        const cuesTexts = (p.pointing_cues ?? []).map((c) => c.text);
        const opts = p.options ?? [];
        const reactionTexts: string[] = [];
        for (const cue of p.pointing_cues ?? []) {
          const target = opts[cue.target_index] ?? '';
          if (target) reactionTexts.push(`Excellent! That's the ${target}. Well done!`);
          for (const chosen of opts) {
            if (!chosen || chosen === target) continue;
            reactionTexts.push(
              `Not quite. That's the ${chosen}. The ${target} is over there. Try the next one!`
            );
          }
        }
        const allTexts = [...cuesTexts, ...reactionTexts];
        if (allTexts.length > 0) {
          void pregenerateYLCueAudiosAction(sid, allTexts);
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
        onSessionFinished?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error finalizing the session');
      }
    })();
  }, [phase, sessionId, plan, score, mode, onSessionFinished]);

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
    <span className="text-xs font-bold bg-white ring-1 ring-violet-200 text-violet-700 px-2 py-1 rounded-md">
      POINTING
    </span>
  );

  const progressDots = (
    <div className="flex items-center gap-1.5" aria-label={`Round ${cueIndex + 1} of ${totalCues}`}>
      {Array.from({ length: totalCues }).map((_, i) => {
        const turn = turns[i];
        const isActive = i === cueIndex && phase !== 'finished';
        const cls = turn
          ? turn.correct
            ? 'bg-green-500'
            : 'bg-red-500'
          : isActive
          ? 'bg-blue-500 ring-2 ring-blue-200'
          : 'bg-gray-200';
        return <span key={i} className={`w-2.5 h-2.5 rounded-full ${cls}`} />;
      })}
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
        headerConfig={{ icon: ListenAndPointIcon, title: 'Listen and Point', subtitle: 'Practice history', accentColor: 'violet', leftSlot: backButton, rightSlot: <div className="flex items-center gap-3">{progressDots}{partBadge}</div>, online: false }}
        footerConfig={{ modeLabel: 'YL · POINTING', modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-pointing-readonly"
        maxWidthClass="max-w-full"
      >
        {plan?.options && images.length === plan.options.length && (
          <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 bg-slate-50/95 backdrop-blur-sm border-b border-gray-100">
            <div className="grid grid-cols-4 gap-2 max-w-3xl mx-auto">
              {plan.options.map((label, idx) => (
                <div key={`${idx}-${label}`} className="rounded-xl bg-white shadow-sm overflow-hidden ring-1 ring-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[idx].startsWith('http') || images[idx].startsWith('data:') ? images[idx] : `data:image/png;base64,${images[idx]}`}
                    alt={label}
                    className="w-full aspect-square object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
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
      headerConfig={{ icon: ListenAndPointIcon, title: 'Listen and Point', subtitle: `Ages 6–8 · Round ${cueIndex + 1}/${totalCues}`, accentColor: 'violet', leftSlot: backButton, rightSlot: <div className="flex items-center gap-3">{progressDots}{partBadge}</div>, online: true }}
      footerConfig={{ modeLabel: 'YL · POINTING', modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={bottomBar}
      animationKey="yl-pointing"
      maxWidthClass="max-w-full"
    >
      {plan?.options && images.length === plan.options.length && (
        <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 bg-slate-50/95 backdrop-blur-sm border-b border-gray-100">
          <div className="grid grid-cols-4 gap-2 max-w-3xl mx-auto">
            {plan.options.map((label, idx) => {
              const disabled = phase !== 'ready' || chosenIndex !== null;
              const isChosen = chosenIndex === idx;
              const isTarget = currentCue?.target_index === idx;
              const showResult = phase === 'answered';
              const ringClass = showResult
                ? isTarget
                  ? 'ring-2 ring-green-500'
                  : isChosen
                  ? 'ring-2 ring-red-500'
                  : 'ring-1 ring-gray-100'
                : 'ring-1 ring-gray-100 hover:ring-blue-300';
              return (
                <button
                  key={`${idx}-${label}`}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  disabled={disabled}
                  className={`group rounded-xl bg-white shadow-sm overflow-hidden transition-all ${ringClass} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[idx].startsWith('http') || images[idx].startsWith('data:') ? images[idx] : `data:image/png;base64,${images[idx]}`}
                    alt={label}
                    className={`w-full aspect-square object-cover ${disabled ? '' : 'group-hover:scale-105'} transition-transform`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {turns.map((t) => (
        <React.Fragment key={t.id}>
          <YLBobTextMessage text={t.cueText} />
          <YLUserTextMessage text={`👉 ${t.userPicked} ${t.correct ? '✓' : '✗'}`} />
          {sessionId && (
            <YLVoiceNote
              text={t.reactionText}
              side="bob"
              sessionId={sessionId}
              autoPlay={phase === 'answered' && t.id === `turn-${cueIndex}`}
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

    </ChatShell>
  );
}
