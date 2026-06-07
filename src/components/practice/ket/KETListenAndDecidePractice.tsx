'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generateKETListenDecideAction,
  generateKETListenDecideAudioAction,
  submitKETListenDecideAction,
  type ListenDecideExercise,
  type ListenDecideItem,
  type ItemResult,
  type ConversationTurn,
} from '@/actions/modes/ket-listening-part3';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#F8AC37';
const ACCENT_DARK = '#D8881C';
const ACCENT_TEXT = '#B5710F';
const ACCENT_TINT = 'color-mix(in oklab, #F8AC37 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETListenAndDecidePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';
type AudioStatus = 'loading' | 'ready' | 'error';

interface RestoredState {
  exercise: ListenDecideExercise;
  framingText: string;
  itemResults: ItemResult[] | null;
  correctCount: number;
  conversation: ConversationTurn[];
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let exercise: ListenDecideExercise | null = null;
  let framingText = '';
  let itemResults: ItemResult[] | null = null;
  let correctCount = 0;
  let conversation: ConversationTurn[] = [];

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'listen_decide_plan') {
      const raw = cj.exercise as ListenDecideExercise;
      exercise = { ...raw, audio_b64: '', audio_mime: 'audio/L16;codec=pcm;rate=24000' };
      framingText = String(cj.framing_text ?? '');
      conversation = raw.conversation ?? [];
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      itemResults = cj.item_results as ItemResult[];
      correctCount = Number(cj.score ?? 0);
      conversation = (cj.conversation as ConversationTurn[]) ?? conversation;
    }
  }

  if (exercise) return { exercise, framingText, itemResults, correctCount, conversation };
  return null;
}

let _activeAudio: HTMLAudioElement | null = null;

function stopActiveAudio() {
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.src = '';
    _activeAudio = null;
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AudioPlayer({
  audiob64,
  audiomime,
  status,
}: {
  audiob64: string;
  audiomime: string;
  status: AudioStatus;
}) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLocal = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
    if (_activeAudio === audioRef.current) _activeAudio = null;
  };

  useEffect(() => () => stopLocal(), []);

  const handlePlay = async () => {
    if (playing) {
      stopLocal();
      setProgress(0);
      return;
    }

    stopActiveAudio();

    const url = pcmToWavBase64(audiob64, audiomime);
    const audio = new Audio(url);
    audioRef.current = audio;
    _activeAudio = audio;

    audio.onended = () => {
      stopLocal();
      setHasPlayed(true);
      setProgress(1);
      setTimeout(() => setProgress(0), 600);
    };
    audio.onerror = () => stopLocal();

    setPlaying(true);
    intervalRef.current = setInterval(() => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    }, 100);

    try {
      await audio.play();
    } catch {
      stopLocal();
    }
  };

  if (status === 'error') {
    return (
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
        <div className="rounded-full ring-1 ring-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3 h-12">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-400">
            <PlayIcon />
          </div>
          <p className="flex-1 text-sm font-semibold text-gray-400">Audio unavailable</p>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
        <div className="rounded-full ring-1 ring-sky-100 bg-sky-50 px-3 py-2 flex items-center gap-3 h-12">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white opacity-60"
            style={{ background: ACCENT }}
            aria-hidden
          >
            <Spinner />
          </div>
          <p className="flex-1 text-xs font-semibold" style={{ color: ACCENT_TEXT }}>Preparing audio…</p>
        </div>
      </div>
    );
  }

  const label = playing ? 'Playing…' : hasPlayed ? 'Listen again' : 'Listen to the conversation';

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
      <div className="relative rounded-full ring-1 ring-sky-100 bg-sky-50 px-3 py-2 flex items-center gap-3 h-12 overflow-hidden">
        <div className="relative shrink-0 w-10 h-10">
          {playing && (
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ background: ACCENT }}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={reduceMotion ? { scale: 1, opacity: 0.25 } : { scale: [1, 1.6], opacity: [0.4, 0] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeOut', repeat: Infinity }}
            />
          )}
          <button
            type="button"
            onClick={handlePlay}
            aria-label={label}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 text-white"
            style={{ background: ACCENT }}
          >
            {playing ? <PauseIcon /> : hasPlayed ? <ReplayIcon /> : <PlayIcon />}
          </button>
        </div>
        <p className="flex-1 text-xs font-semibold truncate" style={{ color: ACCENT_TEXT }}>{label}</p>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-sky-200/60">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, background: ACCENT }}
          />
        </div>
      </div>
    </div>
  );
}

function AnsweredDot({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.span
      initial={reduceMotion ? false : { scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"
      aria-hidden
    />
  );
}

function OptionButton({
  optionId,
  text,
  selected,
  onSelect,
  disabled,
  reduceMotion,
}: {
  optionId: 'A' | 'B' | 'C';
  text: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
      className={[
        'relative rounded-2xl border p-4 text-left text-sm font-semibold text-gray-800 cursor-pointer min-h-12 [&:last-child]:col-span-2',
        disabled ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        selected
          ? {
              background: '#FFFBEB',
              borderColor: ACCENT,
              boxShadow: 'none',
              transform: 'translateY(2px)',
            }
          : { background: CARD_SURFACE, borderColor: '#F3F4F6', boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      <span className="block pr-6 leading-snug">{text}</span>
      {selected && (
        <motion.span
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: ACCENT }}
        >
          <Check size={12} strokeWidth={3.5} className="text-white" />
        </motion.span>
      )}
      <span
        className={[
          'absolute bottom-2 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
          selected ? 'opacity-0' : '',
        ].join(' ')}
        style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        aria-hidden
      >
        {optionId}
      </span>
    </motion.button>
  );
}

function QuestionCard({
  item,
  selected,
  onSelect,
  disabled,
  index,
  animate,
  reduceMotion,
}: {
  item: ListenDecideItem;
  selected: 'A' | 'B' | 'C' | undefined;
  onSelect: (v: 'A' | 'B' | 'C') => void;
  disabled: boolean;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const opts = (['A', 'B', 'C'] as const).map((k) => ({ id: k, text: item.options[k] }));

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: animate ? index * 0.07 : 0 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {item.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{item.question}</p>
        {selected && <AnsweredDot reduceMotion={reduceMotion} />}
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {opts.map((opt) => (
          <OptionButton
            key={opt.id}
            optionId={opt.id}
            text={opt.text}
            selected={selected === opt.id}
            onSelect={() => onSelect(opt.id)}
            disabled={disabled}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ResultOptionRow({
  optionId,
  text,
  isChosen,
  isCorrectOption,
  reduceMotion,
}: {
  optionId: 'A' | 'B' | 'C';
  text: string;
  isChosen: boolean;
  isCorrectOption: boolean;
  reduceMotion: boolean;
}) {
  const showGreen = isCorrectOption;
  const showRed = isChosen && !isCorrectOption;
  const shake = showRed && !reduceMotion;

  return (
    <motion.div
      initial={false}
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={shake ? { duration: 0.4 } : { duration: 0 }}
      className={[
        'relative rounded-2xl border p-4 text-sm font-semibold [&:last-child]:col-span-2',
        showGreen ? 'border-green-400 bg-green-50 text-green-800' : '',
        showRed ? 'border-red-400 bg-red-50 text-red-700' : '',
        !showGreen && !showRed ? 'border-gray-100 text-gray-400 opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={!showGreen && !showRed ? { background: CARD_SURFACE } : undefined}
    >
      <span className="block pr-6 leading-snug">{text}</span>
      {showGreen && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <Check size={12} strokeWidth={3.5} className="text-white" />
        </span>
      )}
      <span
        className={[
          'absolute bottom-2 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
          showGreen ? 'bg-green-500 text-white' : showRed ? 'bg-red-400 text-white' : 'bg-gray-200 text-gray-400',
        ].join(' ')}
        aria-hidden
      >
        {optionId}
      </span>
    </motion.div>
  );
}

function ResultQuestionCard({
  item,
  result,
  index,
  animate,
  reduceMotion,
}: {
  item: ListenDecideItem;
  result: ItemResult;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const opts = (['A', 'B', 'C'] as const).map((k) => ({ id: k, text: item.options[k] }));

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: animate ? index * 0.07 : 0 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {item.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{item.question}</p>
        <span
          className={[
            'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
            result.is_correct ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50',
          ].join(' ')}
        >
          {result.is_correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {opts.map((opt) => (
          <ResultOptionRow
            key={opt.id}
            optionId={opt.id}
            text={opt.text}
            isChosen={opt.id === result.chosen}
            isCorrectOption={opt.id === result.correct_answer}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </motion.div>
  );
}

function TranscriptBlock({ turns }: { turns: ConversationTurn[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden" style={{ background: CARD_SURFACE }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span>Show transcript</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-gray-100 pt-3">
          {turns.map((turn, i) => (
            <p key={i} className="text-xs text-gray-600 leading-snug">
              <span className="font-bold text-gray-700 mr-1">
                {turn.speaker === 'M' ? 'Man:' : 'Woman:'}
              </span>
              {turn.line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** KET Listening Part 3 — Listen and Decide practice component. */
export function KETListenAndDecidePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETListenAndDecidePracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<ListenDecideExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [itemResults, setItemResults] = useState<ItemResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('loading');
  const [audioB64, setAudioB64] = useState('');
  const [audioMime, setAudioMime] = useState('audio/L16;codec=pcm;rate=24000');
  const initStartedRef = useRef(false);
  const audioStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setExercise(restored.exercise);
          setFramingText(restored.framingText);
          setConversation(restored.conversation);
          if (restored.itemResults) {
            setItemResults(restored.itemResults);
            setCorrectCount(restored.correctCount);
            setPhase('finished');
          } else {
            const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
            const { data: { user } } = await createSupabaseBrowser().auth.getUser();
            if (user) setUserId(user.id);
            setPhase('ready');
          }
          return;
        }
      }

      if (initialSessionId) return;

      setIsNewSession(true);
      setPhase('generating');

      const result = await generateKETListenDecideAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setSessionId(result.sessionId);
      setUserId(result.userId);
      setExercise(result.exercise);
      setFramingText(result.framing_text);
      setConversation(result.exercise.conversation);
      setPhase('ready');
    }

    void init();
  }, []);

  useEffect(() => {
    if (audioStartedRef.current) return;
    if (phase !== 'ready') return;
    if (!conversation.length) return;
    audioStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const audio = await generateKETListenDecideAudioAction({ conversation });
        if (cancelled) return;
        if (audio.data) {
          setAudioB64(audio.data);
          setAudioMime(audio.mimeType);
          setAudioStatus('ready');
        } else {
          setAudioStatus('error');
        }
      } catch {
        if (!cancelled) setAudioStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, conversation]);

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    stopActiveAudio();
    setPhase('submitting');

    const result = await submitKETListenDecideAction({
      sessionId,
      userId,
      answers,
      exercise,
    });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setItemResults(result.item_results);
    setCorrectCount(result.correct_count);
    setConversation(result.conversation);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = exercise ? answeredCount === exercise.items.length : false;
  const progressPct = exercise && exercise.items.length > 0 ? (answeredCount / exercise.items.length) * 100 : 0;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Back"
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT }}
        >
          <KETListeningIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Listen and Decide</p>
          <p className="text-xs text-gray-400">Listening · Part 3</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          A2
        </span>
      </div>

      {phase === 'ready' && (
        <div className="h-1.5 w-full bg-gray-100 shrink-0 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: ACCENT }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      )}

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Preparing exercise…" />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answers…" />
        </div>
      )}

      {phase === 'ready' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg space-y-4">
              <AudioPlayer audiob64={audioB64} audiomime={audioMime} status={audioStatus} />

              <div className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3" style={{ background: CARD_SURFACE }}>
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: ACCENT_TINT, color: ACCENT }}
                >
                  <KETListeningIcon size={20} />
                </span>
                <p className="text-sm text-gray-700 leading-relaxed flex-1">{framingText}</p>
              </div>

              {exercise.items.map((item, i) => (
                <QuestionCard
                  key={item.number}
                  item={item}
                  index={i}
                  animate={isNewSession}
                  reduceMotion={!!reduceMotion}
                  selected={answers[item.number]}
                  onSelect={(v) => setAnswers((prev) => ({ ...prev, [item.number]: v }))}
                  disabled={false}
                />
              ))}

              <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {answeredCount} of {exercise.items.length} answered
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 cursor-pointer active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                style={{ background: ACCENT, boxShadow: allAnswered ? `0 4px 0 ${ACCENT_DARK}` : 'none' }}
              >
                Check answers
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-4">
            {exercise.items.map((item, i) => {
              const result = itemResults.find((r) => r.number === item.number);
              if (!result) return null;
              return (
                <ResultQuestionCard
                  key={item.number}
                  item={item}
                  result={result}
                  index={i}
                  animate={isNewSession}
                  reduceMotion={!!reduceMotion}
                />
              );
            })}

            {conversation.length > 0 && <TranscriptBlock turns={conversation} />}

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={exercise.items.length}
                feedback="Great listening practice!"
                onAction={onOpenDashboard}
                actionLabel="See my progress"
                animate={isNewSession}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
