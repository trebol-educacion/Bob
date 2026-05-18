'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { FCEReadingIcon } from '@/components/icons/FCEIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateFCEClozeAction,
  submitFCEClozeAnswersAction,
  type ClozeGap,
  type ClozeGapResult,
} from '@/actions/modes/fce-reading-part1';
import type { StoredMessage } from '@/actions/messages';
import { useTranslations } from 'next-intl';

export interface FCEMultipleChoiceClozePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  title: string;
  text_with_gaps: string;
  gaps: ClozeGap[];
  framingText: string;
  results: ClozeGapResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let title = '';
  let text_with_gaps = '';
  let gaps: ClozeGap[] | null = null;
  let framingText = '';
  let results: ClozeGapResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'cloze_plan') {
      title = String(cj.title ?? '');
      text_with_gaps = String(cj.text_with_gaps ?? '');
      gaps = cj.gaps as ClozeGap[];
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      results = cj.results as ClozeGapResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (gaps) return { title, text_with_gaps, gaps, framingText, results, correctCount };
  return null;
}

/**
 * Renders text_with_gaps as an array of React nodes, replacing ___N___ markers
 * with gap number badges. Used in the ready phase.
 */
function renderTextWithGapBadges(text: string): React.ReactNode[] {
  const parts = text.split(/(___\d+___)/g);
  return parts.map((part, idx) => {
    const match = part.match(/^___(\d+)___$/);
    if (match) {
      const num = match[1];
      return (
        <span
          key={idx}
          className="inline-flex items-center justify-center w-7 h-5 mx-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-300 leading-none align-middle"
        >
          {num}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

/**
 * Renders text_with_gaps for the finished phase: replaces ___N___ markers
 * with the chosen word highlighted green (correct) or red (incorrect),
 * and the correct word shown below when wrong.
 */
function renderTextWithResults(text: string, gaps: ClozeGap[], results: ClozeGapResult[]): React.ReactNode[] {
  const resultMap = new Map(results.map((r) => [r.number, r]));
  const gapMap = new Map(gaps.map((g) => [g.number, g]));

  const parts = text.split(/(___\d+___)/g);
  return parts.map((part, idx) => {
    const match = part.match(/^___(\d+)___$/);
    if (!match) return <span key={idx}>{part}</span>;

    const num = parseInt(match[1], 10);
    const result = resultMap.get(num);
    const gap = gapMap.get(num);
    if (!result || !gap) return <span key={idx}>{part}</span>;

    const chosenOption = gap.options.find((o) => o.id === result.chosen);
    const correctOption = gap.options.find((o) => o.id === result.correct_option);
    const chosenText = chosenOption?.text ?? result.chosen;
    const correctText = correctOption?.text ?? result.correct_option;

    if (result.isCorrect) {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-sm font-semibold border border-green-300 align-middle"
        >
          {chosenText}
        </span>
      );
    }

    return (
      <span key={idx} className="inline-flex flex-col items-center mx-0.5 align-middle">
        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-sm font-semibold border border-red-300 line-through">
          {chosenText}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[11px] font-semibold border border-green-300 -mt-px">
          {correctText}
        </span>
      </span>
    );
  });
}

function GapRow({
  gap,
  selected,
  onSelect,
  disabled,
}: {
  gap: ClozeGap;
  selected: 'A' | 'B' | 'C' | 'D' | undefined;
  onSelect: (id: 'A' | 'B' | 'C' | 'D') => void;
  disabled: boolean;
}) {
  const t = useTranslations('cambridge');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: gap.number * 0.05 }}
      className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0">
          {gap.number}
        </span>
        <span className="text-xs font-semibold text-gray-500">
          {t('fce.cloze.gapLabel', { number: gap.number })}
        </span>
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        {gap.options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.id as 'A' | 'B' | 'C' | 'D')}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                isSelected
                  ? 'border-emerald-400 bg-emerald-50 text-gray-800'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40',
                disabled ? 'cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center',
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 bg-white text-gray-500',
                ].join(' ')}
              >
                {opt.id}
              </span>
              <span className="leading-snug truncate">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function GapResultRow({
  gap,
  result,
  animate,
}: {
  gap: ClozeGap;
  result: ClozeGapResult;
  animate: boolean;
}) {
  const t = useTranslations('cambridge');
  const correctOption = gap.options.find((o) => o.id === result.correct_option);
  const correctText = correctOption?.text ?? result.correct_option;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: gap.number * 0.06 }}
      className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0">
          {gap.number}
        </span>
        <span className="text-xs font-semibold text-gray-500 flex-1">
          {t('fce.cloze.gapLabel', { number: gap.number })}
        </span>
        {result.isCorrect ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
            <CheckCircle size={13} /> {t('fce.cloze.correctBadge')}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
            <XCircle size={13} /> {t('fce.cloze.incorrectBadge')}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        {gap.options.map((opt) => {
          const isChosen = result.chosen === opt.id;
          const isCorrectOpt = opt.id === result.correct_option;
          const showGreen = isCorrectOpt;
          const showRed = isChosen && !result.isCorrect;

          return (
            <div
              key={opt.id}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                showGreen ? 'border-green-300 bg-green-50' : '',
                showRed ? 'border-red-300 bg-red-50' : '',
                !showGreen && !showRed ? 'border-gray-100 bg-gray-50 opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center',
                  showGreen ? 'border-green-500 bg-green-500 text-white' : '',
                  showRed ? 'border-red-400 bg-red-400 text-white' : '',
                  !showGreen && !showRed ? 'border-gray-300 bg-white text-gray-400' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {opt.id}
              </span>
              <span
                className={
                  showGreen ? 'text-green-800 truncate' : showRed ? 'text-red-700 truncate' : 'text-gray-400 truncate'
                }
              >
                {opt.text}
              </span>
              {showGreen && <CheckCircle size={13} className="text-green-500 shrink-0 ml-auto" />}
              {showRed && <XCircle size={13} className="text-red-400 shrink-0 ml-auto" />}
            </div>
          );
        })}
      </div>

      {!result.isCorrect && (
        <div className="px-3 pb-2 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{t('fce.cloze.correctAnswerLabel')}</span>{' '}
          <span className="text-green-700 font-semibold">{correctText}</span>
        </div>
      )}

      <div className="px-3 pb-3 text-xs text-gray-500 leading-relaxed">
        <span className="font-semibold text-gray-700">{t('fce.cloze.explanationLabel')}</span>{' '}
        {result.explanation}
      </div>
    </motion.div>
  );
}

/** FCE Reading & Use of English Part 1 — Multiple-Choice Cloze practice component. */
export function FCEMultipleChoiceClozePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: FCEMultipleChoiceClozePracticeProps) {
  const t = useTranslations('cambridge');

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [textWithGaps, setTextWithGaps] = useState('');
  const [gaps, setGaps] = useState<ClozeGap[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [results, setResults] = useState<ClozeGapResult[]>([]);
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
          setTitle(restored.title);
          setTextWithGaps(restored.text_with_gaps);
          setGaps(restored.gaps);
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
      const result = await generateFCEClozeAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      if (!initialSessionId) {
        onSessionCreated?.(result.sessionId);
      }

      setSessionId(result.sessionId);
      setUserId(result.userId);
      setTitle(result.title);
      setTextWithGaps(result.text_with_gaps);
      setGaps(result.gaps);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []);

  function handleSelect(gapNumber: number, optionId: 'A' | 'B' | 'C' | 'D') {
    setAnswers((prev) => ({ ...prev, [gapNumber]: optionId }));
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    setPhase('submitting');

    const result = await submitFCEClozeAnswersAction({
      sessionId,
      userId,
      answers,
      gaps,
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
  const allAnswered = answeredCount === gaps.length && gaps.length > 0;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('fce.cloze.back')}
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
          aria-label={t('fce.cloze.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <FCEReadingIcon size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('fce.cloze.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('fce.cloze.headerSubtitle')}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
          {t('fce.cloze.partBadge')}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.cloze.preparingExercise')} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.cloze.checkingAnswers')} />
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

            <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-1">
                <p className="text-sm font-bold text-gray-800">{title}</p>
              </div>
              <div className="px-4 pb-4 pt-2 text-sm text-gray-700 leading-relaxed">
                {renderTextWithGapBadges(textWithGaps)}
              </div>
            </div>

            <div className="space-y-3">
              {gaps.map((gap) => (
                <GapRow
                  key={gap.number}
                  gap={gap}
                  selected={answers[gap.number]}
                  onSelect={(id) => handleSelect(gap.number, id)}
                  disabled={false}
                />
              ))}
            </div>

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">
              {t('fce.cloze.answeredCount', { answered: answeredCount, total: gaps.length })}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {t('fce.cloze.submitAnswers')}
            </button>
          </div>
        </>
      )}

      {phase === 'finished' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-sm font-bold text-gray-800">{title}</p>
            </div>
            <div className="px-4 pb-4 pt-2 text-sm text-gray-700 leading-relaxed">
              {results.length > 0 && gaps.length > 0
                ? renderTextWithResults(textWithGaps, gaps, results)
                : renderTextWithGapBadges(textWithGaps)}
            </div>
          </div>

          <div className="space-y-3">
            {results.length > 0 && gaps.length > 0
              ? gaps.map((gap) => {
                  const res = results.find((r) => r.number === gap.number);
                  if (!res) return null;
                  return (
                    <GapResultRow
                      key={gap.number}
                      gap={gap}
                      result={res}
                      animate={isNewSession}
                    />
                  );
                })
              : null}
          </div>

          <div className="flex justify-center pt-2">
            <CelebrationCard
              score={correctCount}
              scoreMax={8}
              feedback={t('fce.cloze.celebrationFeedback')}
              onAction={onOpenDashboard}
              actionLabel={t('fce.cloze.celebrationAction')}
              animate={isNewSession}
            />
          </div>
        </div>
      )}
    </div>
  );
}
