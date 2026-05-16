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
import { ArrowLeft, MapPin, Zap } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import {
  startYLSessionAction,
  generateYLImagesParallelAction,
  evaluateYLTurnAction,
  saveYLTurnAction,
  evaluateYLFinalAction,
  getSessionMessagesAction,
  pregenerateYLCueAudiosAction,
} from '@/actions/modes/yl';
import type { YLExam, YLPlan } from '@/lib/types/yl';

const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#E5E7EB"/><circle cx="200" cy="160" r="48" fill="#D1D5DB"/><rect x="120" y="230" width="160" height="100" rx="12" fill="#D1D5DB"/></svg>'
  );
import type { EvalResponse, ModeKey } from '@/lib/types/practice';
import { ChatShell } from '@/components/ChatShell';
import {
  RECORDING_MAX_SECONDS,
  playTTS,
  stopCurrentAudio,
  YLLoadingScreen,
  YLErrorScreen,
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

type Phase =
  | 'loading'
  | 'ready'
  | 'cue-ready'
  | 'playing-cue'
  | 'recording'
  | 'processing'
  | 'reaction-ready'
  | 'evaluating'
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
  onSessionCreated?: (sessionId: string) => void;
}

export function YLPart1Practice({
  exam,
  part,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
}: YLPart1PracticeProps) {
  const mode: ModeKey = `cambridge_${exam}_part${part}` as ModeKey;

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
  const [loadingStage, setLoadingStage] = useState<string>('Getting your practice ready…');

  const recordedBlobRef = useRef<Blob | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnQAsRef = useRef<{ cue: string; transcript: string }[]>([]);
  const wasRecordingRef = useRef(false);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
    },
    onError: (err) => {
      console.warn('[YL][movers_part1] recording error:', err.message);
      wasRecordingRef.current = false;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setPhase('cue-ready');
    },
  });

  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const initStartedRef = useRef(false);
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    // If we already have a sessionId (reopened from sidebar) the work is
    // done — never regenerate. The chat is built from the persisted
    // bob_messages passed in via initialMessages.
    if (initialSessionId) {
      setSessionId(initialSessionId);
      const cuesFromMsgs = (initialMessages ?? [])
        .filter((m) => m.role === 'bob' && m.msg_type === 'yl_tts')
        .map((m) => (m.content_text as string) || '')
        .filter((s) => s.length > 0);
      const imgsFromMsgs = (initialMessages ?? [])
        .filter((m) => m.role === 'bob' && m.msg_type === 'image_scene')
        .map((m) => (m.content_json as { image_data_uri?: string } | null)?.image_data_uri)
        .filter((u): u is string => typeof u === 'string');
      const completedTurns = (initialMessages ?? [])
        .filter((m) => m.role === 'bob' && m.msg_type === 'yl_cue').length;

      if (imgsFromMsgs.length > 0) setImages(imgsFromMsgs);
      if (cuesFromMsgs.length > 0) setPlan({ cues: cuesFromMsgs } as YLPlan);

      if (cuesFromMsgs.length > 0 && completedTurns < cuesFromMsgs.length) {
        setCueIndex(completedTurns);
        setPhase('ready');
      } else {
        setPhase('finished');
      }
      return;
    }

    if (isReadOnly) return;

    async function init() {
      try {
        const { sessionId: sid, plan: p } = await startYLSessionAction({ mode });
        setSessionId(sid);
        onSessionCreated?.(sid);
        setPlan(p);

        const prompts = p.image_prompts ?? [];
        if (prompts.length > 0) {
          setImages(new Array(prompts.length).fill(IMAGE_PLACEHOLDER));
        }

        setPhase('ready');

        void pregenerateYLCueAudiosAction(sid, p.cues ?? []);

        if (prompts.length > 0) {
          void generateYLImagesParallelAction(exam, part, prompts, sid, p.character_description)
            .then((urls) => {
              setImages(urls);
            })
            .catch(() => {
              // placeholders permanecen si falla
            });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al preparar la sesión');
      }
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (phase === 'ready' && plan) {
      loadCue(cueIndex);
    }
  }, [phase, plan, loadCue, cueIndex]);

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

  useEffect(() => {
    if (phase !== 'recording') return;
    if (isRecording) {
      wasRecordingRef.current = true;
      return;
    }
    if (!wasRecordingRef.current) return;
    wasRecordingRef.current = false;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const blob = recordedBlobRef.current;
    if (!blob || blob.size === 0) {
      setPhase('cue-ready');
      return;
    }

    void (async () => {
      setPhase('processing');
      try {
        const audioBase64 = await blobToBase64(blob);
        const audioDuration = recordingSeconds;

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
          transcript: evalResult.transcript,
          reaction: evalResult.reaction,
          evalResult,
        });

        turnQAsRef.current.push({ cue: currentCue, transcript: evalResult.transcript });

        setCurrentReaction(evalResult.reaction);
        setPhase('reaction-ready');

        void playTTS(evalResult.reaction);
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
          turnsCount: plan.cues.length,
        });
        setFinalEval(result);
        setPhase('finished');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en evaluación final');
      }
    })();
  }, [phase, sessionId, plan, mode]);


  const partLabel =
    exam === 'starters'
      ? 'Starters Part 1 — Señalar imágenes'
      : 'Movers Part 1 — Encuentra diferencias';

  const headerIcon = exam === 'starters' ? MapPin : Zap;
  const headerTitle = exam === 'starters' ? 'Starters — Part 1' : 'Movers — Speaking';
  const headerSubtitle = exam === 'starters' ? 'Ages 6–8 · Part 1' : 'Ages 7–9 · Part 1';
  const partBadgeLabel = exam === 'starters' ? 'PART 1' : 'PART 1';

  const totalCues = plan?.cues.length ?? 1;
  const progress = Math.round(((cueIndex + (phase === 'reaction-ready' ? 1 : 0)) / totalCues) * 100);

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

  if (error) {
    return <YLErrorScreen error={error} onBack={onBack} />;
  }

  if (phase === 'loading') {
    return <YLLoadingScreen message="Getting your practice ready…" />;
  }

  if (phase === 'evaluating') {
    return <YLLoadingScreen message="Calculating your final score…" />;
  }

  if (phase === 'finished' && isReadOnly) {
    return (
      <ChatShell
        headerConfig={{ icon: headerIcon, title: headerTitle, subtitle: 'Practice history', accentColor: 'amber', leftSlot: backButton, rightSlot: partBadge, online: false }}
        footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={null}
        animationKey="yl-part1-readonly"
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
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6"
      >
        <YLResultsHeader title="Practice complete!" subtitle={partLabel} />
        <YLScoreDisplay evalResult={finalEval} />
        <YLFeedbackCard feedback={finalEval.feedback} />
        <div className="flex gap-3 pb-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-trebol-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Back to activities
          </button>
        </div>
      </motion.div>
    );
  }

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
    const lastTranscript = turnQAsRef.current[turnQAsRef.current.length - 1]?.transcript ?? '';
    const displayTranscript = lastTranscript === '(silence)' ? '' : lastTranscript;
    chatItems.push({ kind: 'user-text', id: `u-curr`, text: displayTranscript });
    chatItems.push({ kind: 'reaction-text', id: `r-t-${cueIndex}`, text: currentReaction });
    chatItems.push({ kind: 'reaction-voice', id: `r-v-${cueIndex}`, text: currentReaction });
  }

  const isProcessing = phase === 'processing';

  const inputBar = (
    <div className="flex flex-col">
      <YLChatMicBar
        onStart={handleStartRecording}
        onStop={handleStopRecording}
        isRecording={phase === 'recording' && isRecording}
        seconds={recordingSeconds}
        maxSeconds={RECORDING_MAX_SECONDS}
        disabled={isProcessing}
        helperText={
          phase === 'playing-cue'
            ? 'Bob is speaking…'
            : isProcessing
            ? 'Processing your answer…'
            : phase === 'reaction-ready'
            ? 'Try again or move on'
            : 'Tap to answer with your voice'
        }
      />
      {phase === 'reaction-ready' && (
        <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex items-center justify-center">
          <button
            type="button"
            onClick={handleNextCue}
            className="px-6 py-3 rounded-full bg-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            Next question
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6 4l12 8-12 8V4z" />
              <rect x="18" y="4" width="2" height="16" />
            </svg>
          </button>
        </div>
      )}
    </div>
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

  return (
    <ChatShell
      headerConfig={{ icon: headerIcon, title: headerTitle, subtitle: `${headerSubtitle} · Cue ${cueIndex + 1}/${totalCues}`, accentColor: 'amber', leftSlot: backButton, rightSlot: <div className="flex items-center gap-2">{progressBar}{partBadge}</div>, online: true }}
      footerConfig={{ modeLabel: `YL · ${partBadgeLabel}`, modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputBar}
      animationKey="yl-part1"
    >
      {chatItems.map((item) => {
        switch (item.kind) {
          case 'image':
            return <YLImageMessage key={item.id} src={item.src} />;
          case 'bob-text':
          case 'reaction-text':
            return <YLBobTextMessage key={item.id} text={item.text} />;
          case 'bob-voice':
            return (
              <YLVoiceNote
                key={item.id}
                text={item.text}
                side="bob"
                sessionId={sessionId}
                autoPlay={item.id === `cue-v-${cueIndex}`}
              />
            );
          case 'reaction-voice':
            return <YLVoiceNote key={item.id} text={item.text} side="bob" sessionId={sessionId} autoPlay />;
          case 'user-text':
            return <YLUserTextMessage key={item.id} text={item.text} />;
        }
      })}
      {isProcessing && (
        <div className="flex justify-start gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100 mt-1">
            B
          </div>
          <div className="rounded-2xl px-4 py-3 bg-white border border-gray-100 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '120ms' }} />
            <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
        </div>
      )}
    </ChatShell>
  );
}
