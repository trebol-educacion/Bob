'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import {
  generateKETSignsAndNoticesAction,
  submitKETSignsAnswersAction,
  generateKETSignImagesAction,
  type SignItem,
  type SignAnswerResult,
} from '@/actions/modes/ket-reading-part1';
import type { StoredMessage } from '@/actions/messages';
import { useTranslations } from 'next-intl';

const ACCENT = '#469E7B';
const ACCENT_DARK = '#37795E';
const ACCENT_TEXT = '#2F6B52';
const ACCENT_TINT = 'color-mix(in oklab, #469E7B 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETSignsAndNoticesPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

type SignStyle = 'warning' | 'prohibition' | 'info' | 'shop' | 'default';

const PLACEHOLDER_ACCENT: Record<SignStyle, string> = {
  prohibition: '#469E7B',
  warning: '#FBBF24',
  info: '#38BDF8',
  shop: '#A78BFA',
  default: '#94A3B8',
};

function placeholderAccent(item: SignItem): string {
  return PLACEHOLDER_ACCENT[item.sign_style ?? 'default'];
}

interface RestoredState {
  items: SignItem[];
  framingText: string;
  results: SignAnswerResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let items: SignItem[] | null = null;
  let framingText = '';
  let results: SignAnswerResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'reading_prompt') {
      items = cj.items as SignItem[];
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      results = cj.results as SignAnswerResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (items) return { items, framingText, results, correctCount };
  return null;
}

function SignBoard({ item, imageUrl }: { item: SignItem; imageUrl?: string }) {
  const accent = placeholderAccent(item);
  return (
    <div className="rounded-2xl overflow-hidden shadow-md border border-gray-100 bg-white select-none">
      <div className="relative aspect-[16/10] w-full">
        {imageUrl ? (
          <Image src={imageUrl} alt={item.sign_context} fill unoptimized className="object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${accent} 22%, white), color-mix(in oklab, ${accent} 8%, white))` }}
          >
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} aria-hidden strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="px-4 py-3 text-center border-t border-gray-100">
        <p className="text-lg sm:text-xl font-black uppercase tracking-wide leading-snug break-words text-gray-800">
          {item.sign_text}
        </p>
      </div>
    </div>
  );
}

function OptionCard({
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
        'relative w-full rounded-2xl border p-4 pr-10 text-left text-sm font-semibold text-gray-800 min-h-14 cursor-pointer',
        disabled ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        selected
          ? {
              background: ACCENT_TINT,
              borderColor: ACCENT,
              boxShadow: 'none',
              transform: 'translateY(2px)',
            }
          : { background: CARD_SURFACE, borderColor: '#F3F4F6', boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      <span className="block leading-snug">{text}</span>
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

function ProgressDots({
  items,
  answers,
  current,
  onJump,
  reduceMotion,
}: {
  items: SignItem[];
  answers: Record<number, 'A' | 'B' | 'C'>;
  current: number;
  onJump: (index: number) => void;
  reduceMotion: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((item, i) => {
        const answered = answers[item.number] !== undefined;
        const isCurrent = i === current;
        return (
          <button
            key={item.number}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Sign ${i + 1}`}
            className="w-7 h-7 flex items-center justify-center rounded-full"
          >
            {answered ? (
              <motion.span
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: ACCENT }}
              >
                <Check size={13} strokeWidth={3.5} className="text-white" />
              </motion.span>
            ) : (
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={
                  isCurrent
                    ? { background: 'white', boxShadow: `0 0 0 2.5px ${ACCENT}` }
                    : { background: '#E5E7EB' }
                }
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ResultCard({
  item,
  result,
  index,
  animate,
  reduceMotion,
  explanationLabel,
  imageUrl,
}: {
  item: SignItem;
  result: SignAnswerResult;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
  explanationLabel: string;
  imageUrl?: string;
}) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: animate ? index * 0.07 : 0 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0"
            style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
          >
            {item.number}
          </span>
          <p className="text-xs text-gray-400 leading-tight flex-1">{item.sign_context}</p>
          <span
            className={[
              'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
              result.isCorrect ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100',
            ].join(' ')}
          >
            {result.isCorrect ? 'Correct' : 'Incorrect'}
          </span>
        </div>

        <SignBoard item={item} imageUrl={imageUrl} />
      </div>

      <div className="px-4 pb-4 space-y-2">
        {item.options.map((opt) => {
          const isChosen = result.chosen === opt.id;
          const isCorrectOpt = opt.id === result.correct_option;
          const showGreen = isCorrectOpt;
          const showWrongChoice = isChosen && !result.isCorrect;

          return (
            <div
              key={opt.id}
              className={[
                'relative rounded-2xl border p-4 pr-10 text-sm font-semibold',
                showGreen ? 'border-green-400 bg-green-50 text-green-800' : '',
                showWrongChoice ? 'border-gray-200 text-gray-500 line-through' : '',
                !showGreen && !showWrongChoice ? 'border-gray-100 text-gray-400 opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={!showGreen ? { background: CARD_SURFACE } : undefined}
            >
              <span className="block leading-snug">{opt.text}</span>
              {showGreen && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={12} strokeWidth={3.5} className="text-white" />
                </span>
              )}
              <span
                className={[
                  'absolute bottom-2 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
                  showGreen ? 'bg-green-500 text-white' : showWrongChoice ? 'bg-gray-300 text-gray-600' : 'bg-gray-200 text-gray-400',
                ].join(' ')}
                aria-hidden
              >
                {opt.id}
              </span>
            </div>
          );
        })}

        <div className="mt-1 px-1 text-xs text-gray-500 leading-relaxed">
          <span className="font-semibold text-gray-700">{explanationLabel}</span>{' '}
          {result.explanation}
        </div>
      </div>
    </motion.div>
  );
}

/** KET Reading Part 1 — Signs and Notices practice component. */
export function KETSignsAndNoticesPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETSignsAndNoticesPracticeProps) {
  const t = useTranslations('cambridge');
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [items, setItems] = useState<SignItem[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<SignAnswerResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [signImages, setSignImages] = useState<Record<number, string>>({});
  const initStartedRef = useRef(false);
  const imagesStartedRef = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const result = await generateKETSignsAndNoticesAction({ sessionId: initialSessionId });

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

  useEffect(() => () => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
  }, []);

  useEffect(() => {
    if (imagesStartedRef.current) return;
    if (items.length === 0) return;
    imagesStartedRef.current = true;

    async function loadImages() {
      await Promise.all(
        items.map(async (it) => {
          const result = await generateKETSignImagesAction({
            items: [{ number: it.number, sign_context: it.sign_context, sign_style: it.sign_style ?? 'default' }],
            sessionId,
          }).catch(() => []);
          const url = result[0]?.image_url;
          if (url) setSignImages((prev) => ({ ...prev, [it.number]: url }));
        })
      );
    }

    void loadImages();
  }, [items, sessionId]);

  function handleSelect(itemNumber: number, optionId: 'A' | 'B' | 'C') {
    setAnswers((prev) => ({ ...prev, [itemNumber]: optionId }));
    if (advanceRef.current) clearTimeout(advanceRef.current);
    const isLast = current >= items.length - 1;
    if (!isLast) {
      const delay = reduceMotion ? 0 : 350;
      advanceRef.current = setTimeout(() => setCurrent((c) => Math.min(c + 1, items.length - 1)), delay);
    }
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    if (advanceRef.current) clearTimeout(advanceRef.current);
    setPhase('submitting');

    const result = await submitKETSignsAnswersAction({
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
  const currentItem = items[current];

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('ket.signsAndNotices.back')}
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
          aria-label={t('ket.signsAndNotices.back')}
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT }}
        >
          <KETReadingIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('ket.signsAndNotices.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('ket.signsAndNotices.headerSubtitle')}</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {t('ket.signsAndNotices.partBadge')}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.signsAndNotices.preparingExercise')} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.signsAndNotices.checkingAnswers')} />
        </div>
      )}

      {phase === 'ready' && currentItem && (
        <>
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="mx-auto w-full max-w-lg">
              <ProgressDots
                items={items}
                answers={answers}
                current={current}
                onJump={(i) => {
                  if (advanceRef.current) clearTimeout(advanceRef.current);
                  setCurrent(i);
                }}
                reduceMotion={!!reduceMotion}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg space-y-4">
              {current === 0 && (
                <div
                  className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3"
                  style={{ background: CARD_SURFACE }}
                >
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: ACCENT_TINT, color: ACCENT }}
                  >
                    <KETReadingIcon size={20} />
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">{framingText}</p>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.number}
                  initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="space-y-4"
                >
                  <SignBoard item={currentItem} imageUrl={signImages[currentItem.number]} />

                  <p className="text-sm font-semibold text-gray-700 text-center">{currentItem.question}</p>

                  <div className="space-y-2.5">
                    {currentItem.options.map((opt) => (
                      <OptionCard
                        key={opt.id}
                        optionId={opt.id as 'A' | 'B' | 'C'}
                        text={opt.text}
                        selected={answers[currentItem.number] === opt.id}
                        onSelect={() => handleSelect(currentItem.number, opt.id as 'A' | 'B' | 'C')}
                        disabled={false}
                        reduceMotion={!!reduceMotion}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="h-4" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {t('ket.signsAndNotices.answeredCount', { answered: answeredCount, total: items.length })}
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 cursor-pointer active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                style={{ background: ACCENT, boxShadow: allAnswered ? `0 4px 0 ${ACCENT_DARK}` : 'none' }}
              >
                {t('ket.signsAndNotices.submitAnswers')}
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-4">
            {results.length > 0 && items.length > 0
              ? items.map((item, i) => {
                  const res = results.find((r) => r.number === item.number);
                  if (!res) return null;
                  return (
                    <ResultCard
                      key={item.number}
                      item={item}
                      result={res}
                      index={i}
                      animate={isNewSession}
                      reduceMotion={!!reduceMotion}
                      explanationLabel={t('ket.signsAndNotices.explanationLabel')}
                      imageUrl={signImages[item.number]}
                    />
                  );
                })
              : null}

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={items.length || 6}
                feedback={t('ket.signsAndNotices.celebrationFeedback')}
                onAction={onOpenDashboard}
                actionLabel={t('ket.signsAndNotices.celebrationAction')}
                animate={isNewSession}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
