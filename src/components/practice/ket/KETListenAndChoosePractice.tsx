'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generateKETListenAndChooseAction,
  submitKETListenAnswersAction,
  type ListenItem,
  type ListenAnswerResult,
} from '@/actions/modes/ket-listening-part1';
import type { StoredMessage } from '@/actions/messages';

export interface KETListenAndChoosePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  items: ListenItem[];
  framingText: string;
  results: ListenAnswerResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let items: ListenItem[] | null = null;
  let framingText = '';
  let results: ListenAnswerResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'listening_plan') {
      items = cj.items as ListenItem[];
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      results = cj.results as ListenAnswerResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (items) return { items, framingText, results, correctCount };
  return null;
}

let _activeAudio: HTMLAudioElement | null = null;

function stopActiveAudio(): void {
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

function AudioPlayer({ audiob64, audiomime, itemNumber }: { audiob64: string; audiomime: string; itemNumber: number }) {
  const t = useTranslations('cambridge');
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

  const label = playing
    ? t('ket.listenAndChoose.playing')
    : hasPlayed
    ? t('ket.listenAndChoose.listenAgain')
    : t('ket.listenAndChoose.listen');

  return (
    <div className="flex items-center gap-3 bg-white ring-1 ring-violet-100 rounded-2xl px-3 py-2.5 w-full max-w-xs">
      <button
        type="button"
        onClick={handlePlay}
        aria-label={label}
        className={[
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
          playing
            ? 'bg-violet-600 text-white animate-pulse'
            : 'bg-violet-600 text-white hover:bg-violet-700',
        ].join(' ')}
      >
        {playing ? <PauseIcon /> : hasPlayed ? <ReplayIcon /> : <PlayIcon />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-600 transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{label}</p>
      </div>
      <span className="text-[10px] font-bold text-gray-300 shrink-0">#{itemNumber}</span>
    </div>
  );
}

function OptionCard({
  optionId,
  description,
  imageUrl,
  selected,
  onSelect,
  disabled,
}: {
  optionId: 'A' | 'B' | 'C';
  description: string;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={[
        'flex items-center gap-3 rounded-xl border p-2 text-left w-full transition-colors cursor-pointer',
        selected
          ? 'border-rose-400 bg-rose-50'
          : 'border-gray-100 bg-gray-50 hover:border-rose-200 hover:bg-rose-50/40',
        disabled ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'shrink-0 w-7 h-7 rounded-full border text-xs font-black flex items-center justify-center',
          selected
            ? 'border-rose-500 bg-rose-500 text-white'
            : 'border-gray-300 bg-white text-gray-500',
        ].join(' ')}
      >
        {optionId}
      </span>
      <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 relative">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={description}
            fill
            sizes="56px"
            className="object-cover"
            unoptimized={imageUrl.startsWith('data:')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">?</div>
        )}
      </div>
      <span className="text-xs text-gray-700 leading-snug flex-1">{description}</span>
    </button>
  );
}

function ListenCard({
  item,
  selected,
  onSelect,
  disabled,
}: {
  item: ListenItem;
  selected: 'A' | 'B' | 'C' | undefined;
  onSelect: (id: 'A' | 'B' | 'C') => void;
  disabled: boolean;
}) {
  const t = useTranslations('cambridge');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: item.number * 0.07 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center shrink-0">
            {item.number}
          </span>
          <p className="text-xs text-gray-400 leading-tight">{item.context}</p>
        </div>

        <AudioPlayer
          audiob64={item.audio_b64}
          audiomime={item.audio_mime}
          itemNumber={item.number}
        />

        <p className="text-xs font-semibold text-gray-600">{t('ket.listenAndChoose.questionLabel')} {item.question}</p>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {item.options.map((opt) => (
          <OptionCard
            key={opt.id}
            optionId={opt.id}
            description={opt.description}
            imageUrl={opt.image_url}
            selected={selected === opt.id}
            onSelect={() => onSelect(opt.id)}
            disabled={disabled}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ResultOptionRow({
  optionId,
  description,
  imageUrl,
  isChosen,
  isCorrectOption,
}: {
  optionId: 'A' | 'B' | 'C';
  description: string;
  imageUrl: string;
  isChosen: boolean;
  isCorrectOption: boolean;
}) {
  const showGreen = isCorrectOption;
  const showRed = isChosen && !isCorrectOption;

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border p-2 text-sm',
        showGreen ? 'border-green-300 bg-green-50' : '',
        showRed ? 'border-red-300 bg-red-50' : '',
        !showGreen && !showRed ? 'border-gray-100 bg-gray-50 opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'shrink-0 w-7 h-7 rounded-full border text-xs font-black flex items-center justify-center',
          showGreen ? 'border-green-500 bg-green-500 text-white' : '',
          showRed ? 'border-red-400 bg-red-400 text-white' : '',
          !showGreen && !showRed ? 'border-gray-300 bg-white text-gray-400' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {optionId}
      </span>
      <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-100 relative">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={description}
            fill
            sizes="48px"
            className="object-cover"
            unoptimized={imageUrl.startsWith('data:')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">?</div>
        )}
      </div>
      <span className={[
        'text-xs leading-snug flex-1',
        showGreen ? 'text-green-800' : showRed ? 'text-red-700' : 'text-gray-400',
      ].join(' ')}>
        {description}
      </span>
      {showGreen && <CheckCircle size={15} className="text-green-500 shrink-0" />}
      {showRed && <XCircle size={15} className="text-red-400 shrink-0" />}
    </div>
  );
}

function ResultCard({
  item,
  result,
  animate,
}: {
  item: ListenItem;
  result: ListenAnswerResult;
  animate: boolean;
}) {
  const t = useTranslations('cambridge');
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: item.number * 0.07 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center shrink-0">
            {item.number}
          </span>
          <p className="text-xs text-gray-400 leading-tight">{item.context}</p>
          {result.isCorrect ? (
            <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Correct
            </span>
          ) : (
            <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              Incorrect
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-gray-600">{item.question}</p>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {item.options.map((opt) => (
          <ResultOptionRow
            key={opt.id}
            optionId={opt.id}
            description={opt.description}
            imageUrl={opt.image_url}
            isChosen={result.chosen === opt.id}
            isCorrectOption={opt.id === result.correct_option}
          />
        ))}
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="text-[11px] text-violet-500 hover:text-violet-700 font-semibold underline underline-offset-2 transition-colors"
        >
          {showTranscript
            ? t('ket.listenAndChoose.hideTranscript')
            : t('ket.listenAndChoose.showTranscript')}
        </button>

        {showTranscript && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5 space-y-1"
          >
            {result.dialogue.map((turn, i) => (
              <p key={i} className="text-[11px] text-gray-600 leading-snug">
                <span className="font-bold text-gray-700 mr-1">
                  {turn.speaker === 'M' ? 'Man:' : 'Woman:'}
                </span>
                {turn.line}
              </p>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/** KET Listening Part 1 — Listen and Choose practice component. */
export function KETListenAndChoosePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETListenAndChoosePracticeProps) {
  const t = useTranslations('cambridge');

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [items, setItems] = useState<ListenItem[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [results, setResults] = useState<ListenAnswerResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setItems(restored.items);
          setFramingText(restored.framingText);
          if (restored.results) {
            setResults(restored.results);
            setCorrectCount(restored.correctCount);
            setPhase('finished');
          } else {
            const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
            const supabase = createSupabaseBrowser();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
            setPhase('ready');
          }
          return;
        }
      }

      if (initialSessionId) {
        return;
      }

      setIsNewSession(true);
      setPhase('generating');

      const result = await generateKETListenAndChooseAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      if (!initialSessionId) {
        onSessionCreated?.(result.sessionId);
      }

      setSessionId(result.sessionId);
      setUserId(result.userId);
      setItems(result.items);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []);

  function handleSelect(itemNumber: number, optionId: 'A' | 'B' | 'C') {
    setAnswers((prev) => ({ ...prev, [itemNumber]: optionId }));
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    stopActiveAudio();
    setPhase('submitting');

    const result = await submitKETListenAnswersAction({
      sessionId,
      userId,
      answers,
      items,
    });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setResults(result.results);
    setCorrectCount(result.correctCount);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === items.length && items.length > 0;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('ket.listenAndChoose.back')}
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
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label={t('ket.listenAndChoose.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
          <KETListeningIcon size={18} className="text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('ket.listenAndChoose.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('ket.listenAndChoose.headerSubtitle')}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold uppercase tracking-widest">
          {t('ket.listenAndChoose.partBadge')}
        </span>
      </div>

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader
            message={
              phase === 'loading'
                ? t('ket.listenAndChoose.preparingExercise')
                : t('ket.listenAndChoose.generatingAudio')
            }
          />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.listenAndChoose.reviewingAnswers')} />
        </div>
      )}

      {phase === 'ready' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                {framingText}
              </div>
            </div>

            {items.map((item) => (
              <ListenCard
                key={item.number}
                item={item}
                selected={answers[item.number]}
                onSelect={(id) => handleSelect(item.number, id)}
                disabled={false}
              />
            ))}

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">
              {t('ket.listenAndChoose.answeredCount', {
                answered: answeredCount,
                total: items.length,
              })}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold shadow-sm hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {t('ket.listenAndChoose.submitAnswers')}
            </button>
          </div>
        </>
      )}

      {phase === 'finished' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {results.length > 0 && items.length > 0
            ? items.map((item) => {
                const res = results.find((r) => r.number === item.number);
                if (!res) return null;
                return (
                  <ResultCard
                    key={item.number}
                    item={item}
                    result={res}
                    animate={isNewSession}
                  />
                );
              })
            : null}

          <div className="flex justify-center pt-2">
            <CelebrationCard
              score={correctCount}
              scoreMax={5}
              feedback={t('ket.listenAndChoose.celebrationFeedback')}
              onAction={onOpenDashboard}
              actionLabel={t('ket.listenAndChoose.celebrationAction')}
              animate={isNewSession}
            />
          </div>
        </div>
      )}
    </div>
  );
}
