'use client';

/**
 * YLWhatsThisPractice — Cambridge Starters Part 3 "What's This?".
 *
 * Bob shows 4 object cards one at a time. For each card the child answers
 * 2 spoken questions: "What's this?" and "Have you got a [X]?".
 * Total: 4 cards × 2 questions = 8 turns.
 *
 * The child always initiates recording via an explicit mic button click.
 * No auto-recording, no countdown.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WhatsThisIcon } from '@/components/icons/StartersIcons';
import { CelebrationCard } from './CelebrationCard';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImagesParallelAction,
  persistYLImagesAction,
  saveYLFinalEvalAction,
  getYLSessionPlanAction,
  pregenerateYLCueAudiosAction,
  evaluateWhatsThisAnswerAction,
} from '@/actions/modes/yl';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import type { YLExam, YLPlan, WhatsThisCard } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import { ChatShell } from '@/components/ChatShell';
import {
  stopCurrentAudio,
  YLLoadingScreen,
  YLErrorScreen,
  YLVoiceNote,
  YLBobTextMessage,
  YLUserTextMessage,
  YLChatMicBar,
  YLReadOnlyMessage,
} from './_shared';

const TOTAL_CARDS = 4;
const TOTAL_TURNS = 8;
const RECORDING_MAX_SECONDS = 30;

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLWhatsThisPracticeProps {
  exam: YLExam;
  part: 3;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: BobMessageShape[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase =
  | 'loading'
  | 'generating-images'
  | 'ready'
  | 'recording'
  | 'processing'
  | 'reaction'
  | 'evaluating'
  | 'finished';

interface TurnEntry {
  id: string;
  question: string;
  transcript: string;
  correct: boolean;
  reactionText: string;
  cardIndex: number;
  questionIndex: number;
}

export function YLWhatsThisPractice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: YLWhatsThisPracticeProps) {
  const t = useTranslations('yl');
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [turns, setTurns] = useState<TurnEntry[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [finalEval, setFinalEval] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initStartedRef = useRef(false);
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

  const currentCards = plan?.object_cards;
  const currentCard: WhatsThisCard | undefined = currentCards?.[cardIndex];
  const currentQuestion = currentCard?.questions?.[questionIndex];
  const cueIndex = cardIndex * 2 + questionIndex;

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    if (initialSessionId) {
      void (async () => {
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
                globalCueIndex: (cj.cue_index as number) ?? 0,
                cue: (cj.cue as string) ?? '',
                transcript: (cj.transcribed as string) ?? (m.content_text as string) ?? '',
              };
            })
            .sort((a, b) => a.globalCueIndex - b.globalCueIndex);

          const bobReactions = (initialMessages ?? [])
            .filter((m) => m.role === 'bob' && m.msg_type === 'yl_cue')
            .map((m) => {
              const cj = (m.content_json as Record<string, unknown> | null) ?? {};
              return {
                globalCueIndex: (cj.cue_index as number) ?? 0,
                reaction: (cj.reaction as string) ?? (m.content_text as string) ?? '',
              };
            });
          const reactionMap = new Map<number, string>();
          for (const r of bobReactions) reactionMap.set(r.globalCueIndex, r.reaction);

          const rebuiltTurns: TurnEntry[] = userTurns.map((t) => {
            const ci = Math.floor(t.globalCueIndex / 2);
            const qi = t.globalCueIndex % 2;
            const card = restoredPlan?.object_cards?.[ci];
            const isQ1 = qi === 0;
            const expectedWord = card?.word ?? '';
            const correct = isQ1
              ? !!(t.transcript && expectedWord && t.transcript.toLowerCase().includes(expectedWord.toLowerCase()))
              : t.transcript.length > 2;
            return {
              id: `turn-${t.globalCueIndex}`,
              question: t.cue,
              transcript: t.transcript,
              correct,
              reactionText: reactionMap.get(t.globalCueIndex) ?? '',
              cardIndex: ci,
              questionIndex: qi,
            };
          });

          setTurns(rebuiltTurns);
          setCorrectCount(rebuiltTurns.filter((t) => t.correct).length);

          const evalMsg = (initialMessages ?? []).find(
            (m) =>
              m.role === 'bob' &&
              m.msg_type === 'evaluation' &&
              (m.content_json as { is_final?: boolean } | null)?.is_final === true
          );
          const totalFromPlan = TOTAL_TURNS;
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
            const nextGlobal = rebuiltTurns.length;
            setCardIndex(Math.floor(nextGlobal / 2));
            setQuestionIndex(nextGlobal % 2);
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

    void (async () => {
      try {
        const { sessionId: sid, plan: p } = await startYLSessionAction({ mode });
        setSessionId(sid);
        onSessionCreated?.(sid);
        setPlan(p);

        if (p.object_cards && p.object_cards.length > 0) {
          setPhase('generating-images');
          const items = p.object_cards.map((card) => ({
            word: card.word,
            scenePrompt: card.image_prompt,
          }));
          const urls = await generateYLImagesParallelAction(
            exam,
            part,
            items,
            sid,
            p.character_description,
            'object_card'
          );
          setImages(urls);
          persistYLImagesAction(sid, urls).catch((err) =>
            console.warn('[YLWhatsThis] persist images failed:', err)
          );

          const questionTexts = p.object_cards.flatMap((card) =>
            card.questions.map((q) => q.text)
          );
          const reactionTexts: string[] = [];
          for (const card of p.object_cards) {
            reactionTexts.push(`That's right! It's a ${card.word}. Well done!`);
            reactionTexts.push(`Good try! It's a ${card.word}.`);
            reactionTexts.push(`Great job! Yes or no — you did it!`);
            reactionTexts.push(`Good try! Keep going!`);
          }
          const allTexts = [...questionTexts, ...reactionTexts];
          void pregenerateYLCueAudiosAction(sid, allTexts);
        }

        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error preparing the session');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'evaluating' || !sessionId || !plan) return;
    const total = TOTAL_TURNS;
    const pct = Math.round((correctCount / total) * 100);
    const result: EvalResponse = {
      score: correctCount,
      score_max: total,
      cefr_band: 'a1',
      feedback:
        pct === 100
          ? 'Perfect! You named every object!'
          : pct >= 50
          ? 'Great job! Keep practising!'
          : "Let's keep practising the words!",
    };
    setFinalEval(result);
    setPhase('finished');
    void saveYLFinalEvalAction(sessionId, result)
      .then(() => onSessionFinished?.())
      .catch((err) => console.warn('[YLWhatsThis] saveYLFinalEvalAction failed:', err));
  }, [phase, sessionId, plan, correctCount, onSessionFinished]);

  const handleStartRecording = async () => {
    if (phase !== 'ready' || isRecording) return;
    recordedBlobRef.current = null;
    setRecordingSeconds(0);
    setPhase('recording');
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
  };

  const handleStopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    stopRecording();
  };

  useEffect(() => {
    if (phase !== 'recording' || isRecording || !recordedBlobRef.current) return;
    const blob = recordedBlobRef.current;
    const duration = recordingSeconds;
    recordedBlobRef.current = null;

    if (!sessionId || !currentQuestion || !currentCard) return;

    setPhase('processing');

    void (async () => {
      try {
        const audioBase64 = await blobToBase64(blob);
        const mimeType = blob.type || 'audio/webm;codecs=opus';
        const questionType: 'what_is_this' | 'have_you_got' =
          questionIndex === 0 ? 'what_is_this' : 'have_you_got';
        const expected = currentQuestion.expected ?? `It's a ${currentCard.word}.`;

        stopCurrentAudio();
        const evalResult = await evaluateWhatsThisAnswerAction({
          sessionId,
          cardIndex,
          questionIndex,
          question: currentQuestion.text,
          questionType,
          expected,
          audioBase64,
          mimeType,
          audioDuration: duration,
        });

        const newTurn: TurnEntry = {
          id: `turn-${cueIndex}`,
          question: currentQuestion.text,
          transcript: evalResult.transcript || '(no audio)',
          correct: evalResult.correct,
          reactionText: evalResult.reaction,
          cardIndex,
          questionIndex,
        };
        setTurns((prev) => [...prev, newTurn]);
        if (evalResult.correct) setCorrectCount((c) => c + 1);

        setPhase('reaction');
      } catch (err) {
        console.warn('[YLWhatsThis] eval error (non-fatal):', err);
        const fallbackTurn: TurnEntry = {
          id: `turn-${cueIndex}`,
          question: currentQuestion.text,
          transcript: '(error)',
          correct: false,
          reactionText: "Good try! Let's keep going!",
          cardIndex,
          questionIndex,
        };
        setTurns((prev) => [...prev, fallbackTurn]);
        setPhase('reaction');
      }
    })();
  }, [phase, isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    const nextGlobal = cueIndex + 1;
    if (nextGlobal >= TOTAL_TURNS) {
      setPhase('evaluating');
      return;
    }
    const nextCard = Math.floor(nextGlobal / 2);
    const nextQuestion = nextGlobal % 2;
    setCardIndex(nextCard);
    setQuestionIndex(nextQuestion);
    setPhase('ready');
  };

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading' || phase === 'generating-images')
    return <YLLoadingScreen message={phase === 'generating-images' ? t('findDifferences.gettingPicturesReady') : t('common.gettingPracticeReady')} />;
  if (phase === 'evaluating')
    return <YLLoadingScreen message={t('common.calculatingScore')} />;

  const totalCards = currentCards?.length ?? TOTAL_CARDS;
  const currentImageUrl = images[cardIndex];

  const backButton = (
    <button
      onClick={onBack}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
      aria-label="Back"
    >
      <ArrowLeft size={18} className="text-gray-600" />
    </button>
  );

  const partBadge = (
    <span className="text-xs font-bold bg-white ring-1 ring-violet-200 text-violet-700 px-2 py-1 rounded-md">
      WHAT'S THIS?
    </span>
  );

  const progressDots = (
    <div className="flex items-center gap-1.5" aria-label={t('whatsThis.turnOf', { current: cueIndex + 1, total: TOTAL_TURNS })}>
      {Array.from({ length: TOTAL_TURNS }).map((_, i) => {
        const turn = turns[i];
        const isActive = i === cueIndex && phase !== 'finished';
        const cls = turn
          ? turn.correct
            ? 'bg-green-500'
            : 'bg-red-500'
          : isActive
          ? 'bg-violet-500 ring-2 ring-violet-200'
          : 'bg-gray-200';
        return <span key={i} className={`w-2.5 h-2.5 rounded-full ${cls}`} />;
      })}
    </div>
  );

  if (phase === 'finished' && isReadOnly) {
    const sourceMessages = initialMessages ?? [];
    const finalMsg = sourceMessages.find(
      (m) =>
        m.msg_type === 'evaluation' &&
        m.role === 'bob' &&
        (m.content_json as { is_final?: boolean } | null)?.is_final === true
    );
    const savedEval: EvalResponse | null =
      finalEval ?? ((finalMsg?.content_json as EvalResponse | undefined) ?? null);

    return (
      <ChatShell
        headerConfig={{
          icon: WhatsThisIcon,
          title: t('whatsThis.title'),
          subtitle: t('common.practiceHistory'),
          accentColor: 'violet',
          leftSlot: backButton,
          rightSlot: (
            <div className="flex items-center gap-3">
              {progressDots}
              {partBadge}
            </div>
          ),
          online: false,
        }}
        footerConfig={{ modeLabel: t('whatsThis.footerLabel'), modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-whatsthis-readonly"
        maxWidthClass="max-w-full"
      >
        {images.length > 0 && (
          <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 bg-slate-50/95 backdrop-blur-sm border-b border-gray-100">
            <div className="flex gap-2 max-w-2xl mx-auto">
              {images.map((url, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl overflow-hidden ring-1 flex-1 ${idx === cardIndex ? 'ring-violet-400 shadow-md' : 'ring-gray-100 opacity-50'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url.startsWith('http') || url.startsWith('data:') ? url : `data:image/png;base64,${url}`}
                    alt={currentCards?.[idx]?.word ?? `Card ${idx + 1}`}
                    className="w-full aspect-square object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {sourceMessages
          .filter((m) => m.msg_type !== 'evaluation' && m.msg_type !== 'yl_tts' && m.msg_type !== 'image_scene')
          .flatMap((m): React.ReactElement[] => {
            if (m.role === 'user' && m.msg_type === 'user_audio') {
              const cue = (m.content_json as { cue?: string } | null)?.cue ?? '';
              const bubbles: React.ReactElement[] = [];
              if (cue) bubbles.push(<YLBobTextMessage key={`${m.id}-cue`} text={cue} />);
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
          <div className="pt-2 flex justify-center">
            <CelebrationCard
              score={savedEval.score}
              scoreMax={savedEval.score_max ?? TOTAL_TURNS}
              feedback={savedEval.feedback}
              onAction={onOpenDashboard}
              actionLabel={t('common.viewMyProgress')}
              animate={false}
            />
          </div>
        )}
      </ChatShell>
    );
  }

  const helperText =
    phase === 'ready'
      ? t('whatsThis.tapMicAnswer')
      : phase === 'recording'
      ? undefined
      : phase === 'processing'
      ? t('whatsThis.bobListening')
      : phase === 'reaction'
      ? t('whatsThis.tapNextGreat')
      : phase === 'finished'
      ? t('whatsThis.allDone')
      : '';

  const micBar = (
    <YLChatMicBar
      onStart={handleStartRecording}
      onStop={handleStopRecording}
      isRecording={isRecording}
      seconds={recordingSeconds}
      maxSeconds={RECORDING_MAX_SECONDS}
      disabled={phase !== 'ready' && !isRecording}
      helperText={helperText}
    />
  );

  const nextButton = phase === 'reaction' ? (
    <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-500 font-medium pl-2">
        {cueIndex + 1 >= TOTAL_TURNS ? t('whatsThis.almostThere') : t('whatsThis.questionOf', { current: cueIndex + 1, total: TOTAL_TURNS })}
      </p>
      <button
        type="button"
        onClick={handleNext}
        className="px-6 py-3 rounded-full bg-violet-600 text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
      >
        {cueIndex + 1 >= TOTAL_TURNS ? t('whatsThis.seeResults') : t('whatsThis.next')}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M6 4l12 8-12 8V4z" />
          <rect x="18" y="4" width="2" height="16" />
        </svg>
      </button>
    </div>
  ) : null;

  const finishedBar = phase === 'finished' && !isReadOnly ? (
    <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex justify-end">
      <button
        type="button"
        onClick={onBack}
        className="px-6 py-3 rounded-full bg-violet-600 text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer"
      >
        {t('common.backToActivities')}
      </button>
    </div>
  ) : null;

  const inputBar = nextButton ?? finishedBar ?? micBar;

  return (
    <ChatShell
      headerConfig={{
        icon: WhatsThisIcon,
        title: t('whatsThis.title'),
        subtitle: `Ages 6–8 · Card ${cardIndex + 1}/${totalCards} · Q${questionIndex + 1}/2`,
        accentColor: 'violet',
        leftSlot: backButton,
        rightSlot: (
          <div className="flex items-center gap-3">
            {progressDots}
            {partBadge}
          </div>
        ),
        online: true,
      }}
      footerConfig={{ modeLabel: t('whatsThis.footerLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputBar}
      animationKey="yl-whatsthis"
      maxWidthClass="max-w-full"
    >
      {images.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 bg-slate-50/95 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-2xl mx-auto">
            {currentImageUrl && (
              <motion.div
                key={`card-${cardIndex}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`rounded-2xl overflow-hidden shadow-md ring-2 ring-violet-300 mx-auto ${phase === 'finished' ? 'max-w-[150px]' : 'max-w-xs'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImageUrl.startsWith('http') || currentImageUrl.startsWith('data:') ? currentImageUrl : `data:image/png;base64,${currentImageUrl}`}
                  alt={currentCard?.word ?? `Card ${cardIndex + 1}`}
                  className="w-full aspect-square object-cover"
                />
              </motion.div>
            )}
            {images.length > 1 && phase !== 'finished' && (
              <div className="flex gap-2 mt-2 justify-center">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg overflow-hidden ring-1 w-12 h-12 shrink-0 ${idx === cardIndex ? 'ring-violet-400' : 'ring-gray-200 opacity-40'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url.startsWith('http') || url.startsWith('data:') ? url : `data:image/png;base64,${url}`}
                      alt={`Card ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {turns.map((t) => {
        const word = currentCards?.[t.cardIndex]?.word ?? '';
        const isWhatIsThis = t.questionIndex === 0;
        const hintText = isWhatIsThis
          ? word
            ? `It's a ${word}`
            : null
          : `Say: "Yes, I have" or "No, I haven't"`;
        return (
          <React.Fragment key={t.id}>
            {sessionId && (
              <YLVoiceNote
                key={`cue-prev-${t.id}`}
                text={t.question}
                side="bob"
                sessionId={sessionId}
                autoPlay={false}
              />
            )}
            <YLUserTextMessage text={`${t.transcript} ${t.correct ? '✓' : '✗'}`} />
            {sessionId && (
              <YLVoiceNote
                text={t.reactionText}
                side="bob"
                sessionId={sessionId}
                autoPlay={phase === 'reaction' && t.id === `turn-${cueIndex}`}
              />
            )}
            {!t.correct && hintText && (
              <div className="flex justify-start pl-12 -mt-1">
                <div className="font-nunito text-xs font-bold text-violet-700/80 bg-violet-50 ring-1 ring-violet-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">
                  <span aria-hidden>💡</span>
                  <span>{hintText}</span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {currentQuestion && phase === 'ready' && sessionId && (
        <YLVoiceNote
          key={`cue-${cueIndex}`}
          text={currentQuestion.text}
          side="bob"
          sessionId={sessionId}
          autoPlay
        />
      )}

      {phase === 'finished' && finalEval && !isReadOnly && (
        <div className="flex justify-center">
          <CelebrationCard
            score={finalEval.score}
            scoreMax={finalEval.score_max ?? TOTAL_TURNS}
            feedback={finalEval.feedback}
            onAction={onOpenDashboard ?? onBack}
            actionLabel={onOpenDashboard ? t('common.viewMyProgress') : t('common.backToActivities')}
          />
        </div>
      )}
    </ChatShell>
  );
}
