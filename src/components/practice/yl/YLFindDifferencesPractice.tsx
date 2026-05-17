'use client';

/**
 * YLFindDifferencesPractice — Cambridge Movers Part 1 "Find the Differences".
 *
 * Bob shows his picture (A) and describes one property of an object.
 * The child describes the same object in their picture (B) with the difference.
 * 4 turns total, one per difference. Binary evaluation per turn.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FindTheDifferencesIcon } from '@/components/icons/MoversIcons';
import { CelebrationCard } from './CelebrationCard';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImagesParallelAction,
  persistYLImagesAction,
  saveYLFinalEvalAction,
  getYLSessionPlanAction,
  pregenerateYLCueAudiosAction,
  evaluateFindDifferencesAnswerAction,
} from '@/actions/modes/yl';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import type { YLExam, YLPlan, FindDifference } from '@/lib/types/yl';
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

const TOTAL_TURNS = 4;
const RECORDING_MAX_SECONDS = 30;

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLFindDifferencesPracticeProps {
  exam: YLExam;
  part: 1;
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
  examinerCue: string;
  transcript: string;
  correct: boolean;
  reactionText: string;
  turnIndex: number;
}

function resolveImageSrc(url: string): string {
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `data:image/png;base64,${url}`;
}

export function YLFindDifferencesPractice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: YLFindDifferencesPracticeProps) {
  const t = useTranslations('yl');
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
  const [differences, setDifferences] = useState<FindDifference[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
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

  const currentDiff: FindDifference | undefined = differences[turnIndex];

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    if (initialSessionId) {
      void (async () => {
        try {
          const restoredPlan = await getYLSessionPlanAction(initialSessionId);
          if (restoredPlan) {
            setPlan(restoredPlan);
            if (restoredPlan.differences && restoredPlan.differences.length > 0) {
              setDifferences(restoredPlan.differences);
            }
          }

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

          const diffs = restoredPlan?.differences ?? [];
          const rebuiltTurns: TurnEntry[] = userTurns.map((t) => {
            const diff = diffs[t.globalCueIndex];
            const expectedValue = diff?.value_b ?? '';
            const correct = !!(
              t.transcript &&
              expectedValue &&
              t.transcript.toLowerCase().includes(expectedValue.toLowerCase())
            );
            return {
              id: `turn-${t.globalCueIndex}`,
              examinerCue: t.cue,
              transcript: t.transcript,
              correct,
              reactionText: reactionMap.get(t.globalCueIndex) ?? '',
              turnIndex: t.globalCueIndex,
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
          const isComplete = !!evalMsg || rebuiltTurns.length >= TOTAL_TURNS;

          if (isComplete) {
            if (evalMsg) {
              const ej = (evalMsg.content_json as Record<string, unknown> | null) ?? {};
              setFinalEval({
                score: (ej.score as number) ?? rebuiltTurns.filter((t) => t.correct).length,
                score_max: (ej.score_max as number) ?? TOTAL_TURNS,
                cefr_band: (ej.cefr_band as 'a1') ?? 'a1',
                feedback: (ej.feedback as string) ?? 'Great work!',
              });
            }
            setPhase('finished');
          } else {
            setTurnIndex(rebuiltTurns.length);
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

        const diffs = p.differences ?? [];
        setDifferences(diffs);

        const imagePrompts = p.image_prompts ?? [];
        if (imagePrompts.length >= 2) {
          setPhase('generating-images');
          const urls = await generateYLImagesParallelAction(
            exam,
            part,
            imagePrompts,
            sid,
            p.character_description,
            'scene'
          );
          setImages(urls);
          persistYLImagesAction(sid, urls).catch((err) =>
            console.warn('[YLFindDifferences] persist images failed:', err)
          );

          const cueTexts = diffs.map((d) => d.examiner_cue);
          const reactionTexts = diffs.flatMap((d) => [
            `Yes! Well spotted!`,
            `Almost — ${d.expected_answer} Good try!`,
          ]);
          void pregenerateYLCueAudiosAction(sid, [...cueTexts, ...reactionTexts]);
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
          ? 'Amazing! You spotted every difference!'
          : pct >= 50
          ? 'Great job! Keep practising!'
          : "Let's keep practising the differences!",
    };
    setFinalEval(result);
    setPhase('finished');
    void saveYLFinalEvalAction(sessionId, result)
      .then(() => onSessionFinished?.())
      .catch((err) => console.warn('[YLFindDifferences] saveYLFinalEvalAction failed:', err));
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

    if (!sessionId || !currentDiff) return;

    setPhase('processing');

    void (async () => {
      try {
        const audioBase64 = await blobToBase64(blob);
        const mimeType = blob.type || 'audio/webm;codecs=opus';

        stopCurrentAudio();
        const evalResult = await evaluateFindDifferencesAnswerAction({
          sessionId,
          turnIndex,
          examinerCue: currentDiff.examiner_cue,
          expectedAnswer: currentDiff.expected_answer,
          audioBase64,
          mimeType,
          audioDuration: duration,
        });

        const newTurn: TurnEntry = {
          id: `turn-${turnIndex}`,
          examinerCue: currentDiff.examiner_cue,
          transcript: evalResult.transcript || '(no audio)',
          correct: evalResult.correct,
          reactionText: evalResult.reaction,
          turnIndex,
        };
        setTurns((prev) => [...prev, newTurn]);
        if (evalResult.correct) setCorrectCount((c) => c + 1);

        setPhase('reaction');
      } catch (err) {
        console.warn('[YLFindDifferences] eval error (non-fatal):', err);
        const fallbackTurn: TurnEntry = {
          id: `turn-${turnIndex}`,
          examinerCue: currentDiff.examiner_cue,
          transcript: '(error)',
          correct: false,
          reactionText: "Good try! Let's keep going!",
          turnIndex,
        };
        setTurns((prev) => [...prev, fallbackTurn]);
        setPhase('reaction');
      }
    })();
  }, [phase, isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    const next = turnIndex + 1;
    if (next >= TOTAL_TURNS) {
      setPhase('evaluating');
      return;
    }
    setTurnIndex(next);
    setPhase('ready');
  };

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading' || phase === 'generating-images')
    return (
      <YLLoadingScreen
        message={phase === 'generating-images' ? t('findDifferences.gettingPicturesReady') : t('common.gettingPracticeReady')}
      />
    );
  if (phase === 'evaluating') return <YLLoadingScreen message={t('common.calculatingScore')} />;

  const imageA = images[0];
  const imageB = images[1];

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
    <span className="text-xs font-bold bg-white ring-1 ring-amber-200 text-amber-700 px-2 py-1 rounded-md">
      PART 1
    </span>
  );

  const progressDots = (
    <div className="flex items-center gap-1.5" aria-label={t('findDifferences.turnOf', { current: turnIndex + 1, total: TOTAL_TURNS })}>
      {Array.from({ length: TOTAL_TURNS }).map((_, i) => {
        const turn = turns[i];
        const isActive = i === turnIndex && phase !== 'finished';
        const cls = turn
          ? turn.correct
            ? 'bg-green-500'
            : 'bg-red-500'
          : isActive
          ? 'bg-amber-500 ring-2 ring-amber-200'
          : 'bg-gray-200';
        return <span key={i} className={`w-2.5 h-2.5 rounded-full ${cls}`} />;
      })}
    </div>
  );

  const imageStrip = (imageA || imageB) ? (
    <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 bg-slate-50/95 backdrop-blur-sm border-b border-gray-100">
      <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
        <div className="flex flex-col gap-1">
          <span className="font-nunito text-[10px] font-bold text-amber-700 uppercase tracking-wider text-center">
            {t('findDifferences.bobsPicture')}
          </span>
          <div className="rounded-xl overflow-hidden ring-1 ring-amber-200 shadow-sm">
            {imageA ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolveImageSrc(imageA)}
                alt="Bob's picture"
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-amber-50 animate-pulse" />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-nunito text-[10px] font-bold text-amber-700 uppercase tracking-wider text-center">
            {t('findDifferences.yourPicture')}
          </span>
          <div className="rounded-xl overflow-hidden ring-1 ring-amber-200 shadow-sm">
            {imageB ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolveImageSrc(imageB)}
                alt="Your picture"
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-amber-50 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

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
          icon: FindTheDifferencesIcon,
          title: t('findDifferences.title'),
          subtitle: t('common.practiceHistory'),
          accentColor: 'amber',
          leftSlot: backButton,
          rightSlot: (
            <div className="flex items-center gap-3">
              {progressDots}
              {partBadge}
            </div>
          ),
          online: false,
        }}
        footerConfig={{ modeLabel: t('findDifferences.footerLabel'), modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-finddiffs-readonly"
        maxWidthClass="max-w-full"
      >
        {imageStrip}
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
      ? "🎙 Tap the mic and describe your picture"
      : phase === 'recording'
      ? undefined
      : phase === 'processing'
      ? '⏳ Bob is listening…'
      : phase === 'reaction'
      ? '✅ Tap Next when ready'
      : phase === 'finished'
      ? '🎉 All done!'
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

  const nextButton =
    phase === 'reaction' ? (
      <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 font-medium pl-2">
          {turnIndex + 1 >= TOTAL_TURNS ? t('findDifferences.lastOne') : t('findDifferences.differenceOf', { current: turnIndex + 1, total: TOTAL_TURNS })}
        </p>
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-3 rounded-full bg-amber-600 text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
        >
          {turnIndex + 1 >= TOTAL_TURNS ? t('findDifferences.seeResults') : t('shared.next')}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M6 4l12 8-12 8V4z" />
            <rect x="18" y="4" width="2" height="16" />
          </svg>
        </button>
      </div>
    ) : null;

  const finishedBar =
    phase === 'finished' && !isReadOnly ? (
      <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-full bg-amber-600 text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          {t('common.backToActivities')}
        </button>
      </div>
    ) : null;

  const inputBar = nextButton ?? finishedBar ?? micBar;

  return (
    <ChatShell
      headerConfig={{
        icon: FindTheDifferencesIcon,
        title: t('findDifferences.title'),
        subtitle: `Ages 8–11 · Turn ${turnIndex + 1}/${TOTAL_TURNS}`,
        accentColor: 'amber',
        leftSlot: backButton,
        rightSlot: (
          <div className="flex items-center gap-3">
            {progressDots}
            {partBadge}
          </div>
        ),
        online: true,
      }}
      footerConfig={{ modeLabel: t('findDifferences.footerLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputBar}
      animationKey="yl-finddiffs"
      maxWidthClass="max-w-full"
    >
      {imageStrip}

      {turns.map((t) => {
        const diff = differences[t.turnIndex];
        const expectedValueB = diff?.value_b ?? '';
        const hintText = expectedValueB
          ? `${diff?.expected_answer ?? `In my picture, the ${diff?.object_word} is ${expectedValueB}.`}`
          : null;
        return (
          <React.Fragment key={t.id}>
            <YLBobTextMessage text={t.examinerCue} />
            <YLUserTextMessage text={`${t.transcript} ${t.correct ? '✓' : '✗'}`} />
            {sessionId && (
              <YLVoiceNote
                text={t.reactionText}
                side="bob"
                sessionId={sessionId}
                autoPlay={phase === 'reaction' && t.id === `turn-${turnIndex}`}
              />
            )}
            {!t.correct && hintText && (
              <div className="flex justify-start pl-12 -mt-1">
                <div className="font-nunito text-xs font-bold text-amber-700/80 bg-amber-50 ring-1 ring-amber-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">
                  <span aria-hidden>💡</span>
                  <span>{hintText}</span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {currentDiff && phase === 'ready' && sessionId && (
        <>
          <YLBobTextMessage text={currentDiff.examiner_cue} />
          <YLVoiceNote
            key={`cue-${turnIndex}`}
            text={currentDiff.examiner_cue}
            side="bob"
            sessionId={sessionId}
            autoPlay
          />
        </>
      )}

      {phase === 'finished' && finalEval && !isReadOnly && (
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <CelebrationCard
              score={finalEval.score}
              scoreMax={finalEval.score_max ?? TOTAL_TURNS}
              feedback={finalEval.feedback}
              onAction={onOpenDashboard ?? onBack}
              actionLabel={onOpenDashboard ? t('common.viewMyProgress') : t('common.backToActivities')}
            />
          </motion.div>
        </div>
      )}
    </ChatShell>
  );
}
