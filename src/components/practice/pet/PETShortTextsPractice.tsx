'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { PETReadingIcon } from '@/components/icons/PETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generatePETShortTextsAction,
  submitPETShortTextsAnswersAction,
  type ShortTextItem,
  type ShortTextAnswerResult,
} from '@/actions/modes/pet-reading-part1';
import type { StoredMessage } from '@/actions/messages';
import { useTranslations } from 'next-intl';

export interface PETShortTextsPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  items: ShortTextItem[];
  framingText: string;
  results: ShortTextAnswerResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let items: ShortTextItem[] | null = null;
  let framingText = '';
  let results: ShortTextAnswerResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'reading_prompt') {
      items = cj.items as ShortTextItem[];
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      results = cj.results as ShortTextAnswerResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (items) return { items, framingText, results, correctCount };
  return null;
}

function textContextEmoji(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes('email')) return '📧';
  if (lower.includes('text') || lower.includes('sms') || lower.includes('message')) return '📱';
  if (lower.includes('postcard')) return '📮';
  if (lower.includes('notice') || lower.includes('sign')) return '📋';
  if (lower.includes('note')) return '📝';
  return '📄';
}

function ShortTextCard({
  item,
  selected,
  onSelect,
  disabled,
}: {
  item: ShortTextItem;
  selected: 'A' | 'B' | 'C' | undefined;
  onSelect: (id: 'A' | 'B' | 'C') => void;
  disabled: boolean;
}) {
  const t = useTranslations('cambridge');
  const emoji = textContextEmoji(item.text_context);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: item.number * 0.06 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex items-center justify-center shrink-0">
            {item.number}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
            {emoji} {item.text_context}
          </span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/30 px-4 py-3">
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
            {item.text_body}
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
                  ? 'border-blue-400 bg-blue-50 text-gray-800'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-blue-200 hover:bg-blue-50/40',
                disabled ? 'cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center mt-0.5',
                  isSelected
                    ? 'border-blue-500 bg-blue-500 text-white'
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
  item: ShortTextItem;
  result: ShortTextAnswerResult;
  animate: boolean;
}) {
  const t = useTranslations('cambridge');
  const emoji = textContextEmoji(item.text_context);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: item.number * 0.07 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex items-center justify-center shrink-0">
            {item.number}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
            {emoji} {item.text_context}
          </span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/30 px-4 py-3">
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
            {item.text_body}
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
          <span className="font-semibold text-gray-700">{t('pet.shortTexts.explanationLabel')}</span>{' '}
          {result.explanation}
        </div>
      </div>
    </motion.div>
  );
}

/** PET Reading Part 1 — Short Texts practice component. */
export function PETShortTextsPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: PETShortTextsPracticeProps) {
  const t = useTranslations('cambridge');

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [items, setItems] = useState<ShortTextItem[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [results, setResults] = useState<ShortTextAnswerResult[]>([]);
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
      const result = await generatePETShortTextsAction({ sessionId: initialSessionId });

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

    const result = await submitPETShortTextsAnswersAction({
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
          {t('pet.shortTexts.back')}
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
          aria-label={t('pet.shortTexts.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <PETReadingIcon size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('pet.shortTexts.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('pet.shortTexts.headerSubtitle')}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-widest">
          {t('pet.shortTexts.partBadge')}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('pet.shortTexts.preparingExercise')} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('pet.shortTexts.checkingAnswers')} />
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
              <ShortTextCard
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
              {t('pet.shortTexts.answeredCount', { answered: answeredCount, total: items.length })}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {t('pet.shortTexts.submitAnswers')}
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
              feedback={t('pet.shortTexts.celebrationFeedback')}
              onAction={onOpenDashboard}
              actionLabel={t('pet.shortTexts.celebrationAction')}
              animate={isNewSession}
            />
          </div>
        </div>
      )}
    </div>
  );
}
