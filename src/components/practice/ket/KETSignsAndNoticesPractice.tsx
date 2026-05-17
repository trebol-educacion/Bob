'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETSignsAndNoticesAction,
  submitKETSignsAnswersAction,
  type SignItem,
  type SignAnswerResult,
} from '@/actions/modes/ket-reading-part1';
import type { StoredMessage } from '@/actions/messages';
import { useTranslations } from 'next-intl';

export interface KETSignsAndNoticesPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  items: SignItem[];
  framingText: string;
  results: SignAnswerResult[];
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

  if (items && results) return { items, framingText, results, correctCount };
  return null;
}

function SignCard({
  item,
  selected,
  onSelect,
  disabled,
}: {
  item: SignItem;
  selected: 'A' | 'B' | 'C' | undefined;
  onSelect: (id: 'A' | 'B' | 'C') => void;
  disabled: boolean;
}) {
  const t = useTranslations('cambridge');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: item.number * 0.06 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center shrink-0">
            {item.number}
          </span>
          <p className="text-xs text-gray-400 leading-tight">{item.sign_context}</p>
        </div>

        <div className="rounded-xl border-2 border-gray-800 bg-gray-800 px-4 py-3 text-center">
          <p className="text-white font-bold text-lg leading-snug tracking-wide">
            {item.sign_text}
          </p>
        </div>

        <p className="text-xs font-semibold text-gray-600 pt-1">{item.question}</p>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {item.options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.id as 'A' | 'B' | 'C')}
              className={[
                'w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
                isSelected
                  ? 'border-rose-400 bg-rose-50 text-gray-800'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-rose-200 hover:bg-rose-50/40',
                disabled ? 'cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center mt-0.5',
                  isSelected
                    ? 'border-rose-500 bg-rose-500 text-white'
                    : 'border-gray-300 bg-white text-gray-500',
                ].join(' ')}
              >
                {opt.id}
              </span>
              <span className="leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function ResultCard({
  item,
  result,
  animate,
}: {
  item: SignItem;
  result: SignAnswerResult;
  animate: boolean;
}) {
  const t = useTranslations('cambridge');

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
          <p className="text-xs text-gray-400 leading-tight">{item.sign_context}</p>
        </div>

        <div className="rounded-xl border-2 border-gray-800 bg-gray-800 px-4 py-3 text-center">
          <p className="text-white font-bold text-lg leading-snug tracking-wide">
            {item.sign_text}
          </p>
        </div>

        <p className="text-xs font-semibold text-gray-600">{item.question}</p>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {item.options.map((opt) => {
          const isChosen = result.chosen === opt.id;
          const isCorrectOpt = opt.id === result.correct_option;
          const showGreen = isCorrectOpt;
          const showRed = isChosen && !result.isCorrect;

          return (
            <div
              key={opt.id}
              className={[
                'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm',
                showGreen ? 'border-green-300 bg-green-50' : '',
                showRed ? 'border-red-300 bg-red-50' : '',
                !showGreen && !showRed ? 'border-gray-100 bg-gray-50 opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center mt-0.5',
                  showGreen ? 'border-green-500 bg-green-500 text-white' : '',
                  showRed ? 'border-red-400 bg-red-400 text-white' : '',
                  !showGreen && !showRed ? 'border-gray-300 bg-white text-gray-400' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {opt.id}
              </span>
              <span className={showGreen ? 'text-green-800' : showRed ? 'text-red-700' : 'text-gray-400'}>
                {opt.text}
              </span>
              {showGreen && (
                <CheckCircle size={15} className="text-green-500 shrink-0 ml-auto mt-0.5" />
              )}
              {showRed && (
                <XCircle size={15} className="text-red-400 shrink-0 ml-auto mt-0.5" />
              )}
            </div>
          );
        })}

        <div className="mt-1 px-1 text-xs text-gray-500 leading-relaxed">
          <span className="font-semibold text-gray-700">{t('ket.signsAndNotices.explanationLabel')}</span>{' '}
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

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [items, setItems] = useState<SignItem[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [results, setResults] = useState<SignAnswerResult[]>([]);
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
          setResults(restored.results);
          setCorrectCount(restored.correctCount);
          setPhase('finished');
          return;
        }
      }

      setIsNewSession(!initialSessionId);
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

  function handleSelect(itemNumber: number, optionId: 'A' | 'B' | 'C') {
    setAnswers((prev) => ({ ...prev, [itemNumber]: optionId }));
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label={t('ket.signsAndNotices.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
          <KETReadingIcon size={18} className="text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('ket.signsAndNotices.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('ket.signsAndNotices.headerSubtitle')}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold uppercase tracking-widest">
          {t('ket.signsAndNotices.partBadge')}
        </span>
      </div>

      {(phase === 'loading') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.signsAndNotices.preparingExercise')} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.signsAndNotices.checkingAnswers')} />
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
              <SignCard
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
              {t('ket.signsAndNotices.answeredCount', { answered: answeredCount, total: items.length })}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold shadow-sm hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {t('ket.signsAndNotices.submitAnswers')}
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
              scoreMax={6}
              feedback={t('ket.signsAndNotices.celebrationFeedback')}
              onAction={onOpenDashboard}
              actionLabel={t('ket.signsAndNotices.celebrationAction')}
              animate={isNewSession}
            />
          </div>
        </div>
      )}
    </div>
  );
}
