'use client';

/**
 * YLTellTheStoryPractice — Cambridge Movers Part 3 "Tell the Story".
 *
 * Bob shares 4 sequential pictures. Bob models scene 1; the child narrates
 * scenes 2, 3, and 4 in chronological order. Binary evaluation per turn.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PictureStoryMoversIcon } from '@/components/icons/MoversIcons';
import { CelebrationCard } from './CelebrationCard';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImagesParallelAction,
  persistYLImagesAction,
  saveYLFinalEvalAction,
  getYLSessionPlanAction,
  pregenerateYLCueAudiosAction,
  evaluateTellTheStoryAnswerAction,
} from '@/actions/modes/yl';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import type { YLExam, YLPlan, StoryScene } from '@/lib/types/yl';
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

const TOTAL_IMAGES = 4;
const CHILD_TURNS = 3;
const RECORDING_MAX_SECONDS = 30;

/**
 * Renders a Bob voicenote whose text is hidden by default. Encourages
 * audio-first practice; the child can opt in to seeing the transcript
 * by clicking "Show text".
 */
function BobAudioOnly({
  text,
  sessionId,
  autoPlay,
  voiceKey,
}: {
  text: string;
  sessionId: string;
  autoPlay?: boolean;
  voiceKey?: string;
}) {
  const t = useTranslations('yl');
  const [showText, setShowText] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <YLVoiceNote key={voiceKey} text={text} side="bob" sessionId={sessionId} autoPlay={autoPlay} />
      <div className="pl-12">
        {showText ? (
          <div className="flex flex-col gap-1 items-start">
            <YLBobTextMessage text={text} />
            <button
              type="button"
              onClick={() => setShowText(false)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline cursor-pointer"
            >
              {t('tellTheStory.hideText')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="text-[11px] font-bold text-amber-700/70 hover:text-amber-800 underline-offset-2 hover:underline cursor-pointer"
          >
            {t('tellTheStory.showText')}
          </button>
        )}
      </div>
    </div>
  );
}

interface BobMessageShape {
  id: string;
  role: string;
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface YLTellTheStoryPracticeProps {
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
  | 'setup'
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
  sceneIndex: number;
  expectedAnswer: string;
}

function resolveImageSrc(url: string): string {
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `data:image/png;base64,${url}`;
}

export function YLTellTheStoryPractice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: YLTellTheStoryPracticeProps) {
  const t = useTranslations('yl');
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;
  const isReadOnly = !!initialMessages && initialMessages.length > 0;

  const [phase, setPhase] = useState<Phase>(isReadOnly ? 'finished' : 'loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [plan, setPlan] = useState<YLPlan | null>(null);
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [sceneIndex, setSceneIndex] = useState(1);
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

  const currentScene: StoryScene | undefined = scenes[sceneIndex];

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    if (initialSessionId) {
      void (async () => {
        try {
          const restoredPlan = await getYLSessionPlanAction(initialSessionId);
          if (restoredPlan) {
            setPlan(restoredPlan);
            if (restoredPlan.scenes && restoredPlan.scenes.length === TOTAL_IMAGES) {
              setScenes(restoredPlan.scenes);
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
                globalCueIndex: (cj.cue_index as number) ?? 1,
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
                globalCueIndex: (cj.cue_index as number) ?? 1,
                reaction: (cj.reaction as string) ?? (m.content_text as string) ?? '',
              };
            });
          const reactionMap = new Map<number, string>();
          for (const r of bobReactions) reactionMap.set(r.globalCueIndex, r.reaction);

          const planScenes = restoredPlan?.scenes ?? [];
          const rebuiltTurns: TurnEntry[] = userTurns.map((t) => {
            const scene = planScenes[t.globalCueIndex];
            const expectedAnswer = scene?.expected_answer ?? '';
            const keywords = scene?.expected_keywords ?? [];
            const correct = !!(
              t.transcript &&
              keywords.some((kw) => t.transcript.toLowerCase().includes(kw.toLowerCase()))
            );
            return {
              id: `turn-${t.globalCueIndex}`,
              examinerCue: t.cue,
              transcript: t.transcript,
              correct,
              reactionText: reactionMap.get(t.globalCueIndex) ?? '',
              sceneIndex: t.globalCueIndex,
              expectedAnswer,
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
          const isComplete = !!evalMsg || rebuiltTurns.length >= CHILD_TURNS;

          if (isComplete) {
            if (evalMsg) {
              const ej = (evalMsg.content_json as Record<string, unknown> | null) ?? {};
              setFinalEval({
                score: (ej.score as number) ?? rebuiltTurns.filter((t) => t.correct).length,
                score_max: (ej.score_max as number) ?? CHILD_TURNS,
                cefr_band: (ej.cefr_band as 'a1') ?? 'a1',
                feedback: (ej.feedback as string) ?? 'Great storytelling!',
              });
            }
            setPhase('finished');
          } else {
            setSceneIndex(rebuiltTurns.length > 0 ? rebuiltTurns[rebuiltTurns.length - 1].sceneIndex + 1 : 1);
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

        const planScenes = p.scenes ?? [];
        setScenes(planScenes);

        const imagePrompts = p.image_prompts ?? [];
        if (imagePrompts.length >= 4) {
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
            console.warn('[YLTellTheStory] persist images failed:', err)
          );

          const storySetupText = p.story_setup ?? '';
          const scene1Model = planScenes[0]?.modeled_description ?? '';
          const cueTexts = planScenes.slice(1).map((s) => s.examiner_cue ?? '');
          const reactionCorrect = planScenes.slice(1).map(() => 'Great storytelling! Keep going!');
          const reactionWrong = planScenes.slice(1).map((s) => `Almost — ${s.expected_answer ?? ''}`);
          void pregenerateYLCueAudiosAction(sid, [
            storySetupText,
            scene1Model,
            ...cueTexts,
            ...reactionCorrect,
            ...reactionWrong,
          ].filter(Boolean));
        }

        setPhase('setup');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error preparing the session');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'evaluating' || !sessionId || !plan) return;
    const total = CHILD_TURNS;
    const pct = Math.round((correctCount / total) * 100);
    const result: EvalResponse = {
      score: correctCount,
      score_max: total,
      cefr_band: 'a1',
      feedback:
        pct === 100
          ? 'Amazing! You told the whole story perfectly!'
          : pct >= 67
          ? 'Great job! You are a great storyteller!'
          : "Good try! Let's keep practising!",
    };
    setFinalEval(result);
    setPhase('finished');
    void saveYLFinalEvalAction(sessionId, result)
      .then(() => onSessionFinished?.())
      .catch((err) => console.warn('[YLTellTheStory] saveYLFinalEvalAction failed:', err));
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

    if (!sessionId || !currentScene) return;

    setPhase('processing');

    void (async () => {
      try {
        const audioBase64 = await blobToBase64(blob);
        const mimeType = blob.type || 'audio/webm;codecs=opus';

        stopCurrentAudio();
        const evalResult = await evaluateTellTheStoryAnswerAction({
          sessionId,
          sceneIndex,
          examinerCue: currentScene.examiner_cue ?? '',
          expectedAnswer: currentScene.expected_answer ?? '',
          expectedKeywords: currentScene.expected_keywords ?? [],
          audioBase64,
          mimeType,
          audioDuration: duration,
        });

        const newTurn: TurnEntry = {
          id: `turn-${sceneIndex}`,
          examinerCue: currentScene.examiner_cue ?? '',
          transcript: evalResult.transcript || '(no audio)',
          correct: evalResult.correct,
          reactionText: evalResult.reaction,
          sceneIndex,
          expectedAnswer: currentScene.expected_answer ?? '',
        };
        setTurns((prev) => [...prev, newTurn]);
        if (evalResult.correct) setCorrectCount((c) => c + 1);

        setPhase('reaction');
      } catch (err) {
        console.warn('[YLTellTheStory] eval error (non-fatal):', err);
        const fallbackTurn: TurnEntry = {
          id: `turn-${sceneIndex}`,
          examinerCue: currentScene.examiner_cue ?? '',
          transcript: '(error)',
          correct: false,
          reactionText: "Good try! Let's keep going!",
          sceneIndex,
          expectedAnswer: currentScene.expected_answer ?? '',
        };
        setTurns((prev) => [...prev, fallbackTurn]);
        setPhase('reaction');
      }
    })();
  }, [phase, isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    const nextScene = sceneIndex + 1;
    if (nextScene > CHILD_TURNS) {
      setPhase('evaluating');
      return;
    }
    setSceneIndex(nextScene);
    setPhase('ready');
  };

  if (error) return <YLErrorScreen error={error} onBack={onBack} />;
  if (phase === 'loading' || phase === 'generating-images')
    return (
      <YLLoadingScreen
        message={phase === 'generating-images' ? t('tellTheStory.gettingStoryReady') : t('common.gettingPracticeReady')}
      />
    );
  if (phase === 'evaluating') return <YLLoadingScreen message={t('common.calculatingScore')} />;

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
      PART 3
    </span>
  );

  const progressDots = (
    <div className="flex items-center gap-1.5" aria-label={t('tellTheStory.turnOf', { current: sceneIndex, total: CHILD_TURNS })}>
      {Array.from({ length: CHILD_TURNS }).map((_, i) => {
        const turnForDot = turns.find((t) => t.sceneIndex === i + 1);
        const isActive = i + 1 === sceneIndex && phase !== 'finished';
        const cls = turnForDot
          ? turnForDot.correct
            ? 'bg-green-500'
            : 'bg-red-500'
          : isActive
          ? 'bg-amber-500 ring-2 ring-amber-200'
          : 'bg-gray-200';
        return <span key={i} className={`w-2.5 h-2.5 rounded-full ${cls}`} />;
      })}
    </div>
  );

  const activeImageIndex = phase === 'setup' ? 0 : sceneIndex;

  const imageStrip = images.length > 0 ? (
    <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 bg-slate-50/95 backdrop-blur-sm border-b border-gray-100">
      <div className="flex flex-col gap-2 max-w-md mx-auto">
        <div className="rounded-xl overflow-hidden ring-1 ring-amber-200 shadow-sm bg-amber-50/40 flex items-center justify-center">
          {images[activeImageIndex] ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={resolveImageSrc(images[activeImageIndex])}
              alt={`Story picture ${activeImageIndex + 1}`}
              className="w-full max-h-64 object-contain"
            />
          ) : (
            <div className="w-full h-64 bg-amber-50 animate-pulse" />
          )}
        </div>
        <div className="flex gap-1.5 justify-center">
          {Array.from({ length: TOTAL_IMAGES }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-lg overflow-hidden ring-1 transition-all ${
                i === activeImageIndex
                  ? 'ring-amber-400 shadow-md'
                  : 'ring-amber-100 opacity-60'
              }`}
            >
              {images[i] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={resolveImageSrc(images[i])}
                  alt={`Picture ${i + 1}`}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-amber-50 animate-pulse" />
              )}
            </div>
          ))}
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
          icon: PictureStoryMoversIcon,
          title: t('tellTheStory.title'),
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
        footerConfig={{ modeLabel: t('tellTheStory.footerLabel'), modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-tellthestory-readonly"
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
              scoreMax={savedEval.score_max ?? CHILD_TURNS}
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
    phase === 'setup'
      ? t('tellTheStory.listenThenContinue')
      : phase === 'ready'
      ? t('tellTheStory.tapMicDescribe')
      : phase === 'recording'
      ? undefined
      : phase === 'processing'
      ? t('tellTheStory.bobListening')
      : phase === 'reaction'
      ? t('tellTheStory.tapNext')
      : phase === 'finished'
      ? t('tellTheStory.allDone')
      : '';

  const setupBar =
    phase === 'setup' ? (
      <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            stopCurrentAudio();
            setSceneIndex(1);
            setPhase('ready');
          }}
          className="px-6 py-3 rounded-full text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          {t('tellTheStory.continue')}
        </button>
      </div>
    ) : null;

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
          {sceneIndex >= CHILD_TURNS ? t('tellTheStory.lastPicture') : t('tellTheStory.pictureOf', { current: sceneIndex + 1, total: TOTAL_IMAGES })}
        </p>
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-3 rounded-full text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          {sceneIndex >= CHILD_TURNS ? t('tellTheStory.seeResults') : t('tellTheStory.next')}
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
          className="px-6 py-3 rounded-full text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          {t('common.backToActivities')}
        </button>
      </div>
    ) : null;

  const inputBar = setupBar ?? nextButton ?? finishedBar ?? micBar;

  const scene1 = scenes[0];
  const subtitleText = phase === 'setup'
    ? t('tellTheStory.storyIntroSubtitle')
    : t('tellTheStory.pictureSubtitle', { current: activeImageIndex + 1, total: TOTAL_IMAGES });

  return (
    <ChatShell
      headerConfig={{
        icon: PictureStoryMoversIcon,
        title: t('tellTheStory.title'),
        subtitle: subtitleText,
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
      footerConfig={{ modeLabel: t('tellTheStory.footerLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputBar}
      animationKey="yl-tellthestory"
      maxWidthClass="max-w-full"
    >
      {imageStrip}

      {sessionId && plan && phase !== 'finished' && (
        <>
          {plan.story_setup && (
            <BobAudioOnly
              voiceKey="story-setup"
              text={plan.story_setup}
              sessionId={sessionId}
              autoPlay={phase === 'setup'}
            />
          )}
          {scene1?.modeled_description && (
            <BobAudioOnly
              voiceKey="modeled-description"
              text={scene1.modeled_description}
              sessionId={sessionId}
              autoPlay={false}
            />
          )}
        </>
      )}

      {turns.map((t) => (
        <React.Fragment key={t.id}>
          {sessionId && (
            <BobAudioOnly
              voiceKey={`cue-prev-${t.id}`}
              text={t.examinerCue}
              sessionId={sessionId}
              autoPlay={false}
            />
          )}
          <YLUserTextMessage text={`${t.transcript} ${t.correct ? '✓' : '✗'}`} />
          {sessionId && (
            <BobAudioOnly
              voiceKey={`reaction-${t.id}`}
              text={t.reactionText}
              sessionId={sessionId}
              autoPlay={phase === 'reaction' && t.id === `turn-${sceneIndex}`}
            />
          )}
          {!t.correct && t.expectedAnswer && (
            <div className="flex justify-start pl-12 -mt-1">
              <div className="font-nunito text-xs font-bold text-amber-700/80 bg-amber-50 ring-1 ring-amber-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">
                <span aria-hidden>💡</span>
                <span>{t.expectedAnswer}</span>
              </div>
            </div>
          )}
        </React.Fragment>
      ))}

      {currentScene && phase === 'ready' && sessionId && (
        <BobAudioOnly
          voiceKey={`cue-${sceneIndex}`}
          text={currentScene.examiner_cue ?? 'And now? Tell me what happens.'}
          sessionId={sessionId}
          autoPlay
        />
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
              scoreMax={finalEval.score_max ?? CHILD_TURNS}
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
