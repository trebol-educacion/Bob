'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FCEReadingIcon } from '@/components/icons/FCEIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { GapText, type GapReview } from '@/components/practice/gap-text';
import { GapRow, GapResultRow } from './FCEClozeGapCards';
import { generateFCEClozeAction, submitFCEClozeAnswersAction } from '@/actions/modes/fce-reading-part1';
import type { ClozeGap, ClozeGapResult, ClozeOptionId } from '@/lib/reading/fce-cloze-bank';
import type { StoredMessage } from '@/actions/messages';
import { resolveActivityBoot } from '@/lib/activity/boot';
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
  groupId: string;
  title: string;
  text_with_gaps: string;
  gaps: ClozeGap[];
  framingText: string;
  results: ClozeGapResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let groupId = '';
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
      groupId = String(cj.bank_group_id ?? '');
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

  if (gaps) return { groupId, title, text_with_gaps, gaps, framingText, results, correctCount };
  return null;
}


function buildReview(gaps: ClozeGap[], results: ClozeGapResult[]): Record<number, GapReview> {
  const gapMap = new Map(gaps.map((g) => [g.number, g]));
  const review: Record<number, GapReview> = {};
  for (const result of results) {
    const gap = gapMap.get(result.number);
    if (!gap) continue;
    const textOf = (id: string) => gap.options.find((o) => o.id === id)?.text ?? id;
    review[result.number] = {
      isCorrect: result.isCorrect,
      given: textOf(result.chosen),
      expected: textOf(result.correct_option),
    };
  }
  return review;
}

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
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [textWithGaps, setTextWithGaps] = useState('');
  const [gaps, setGaps] = useState<ClozeGap[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, ClozeOptionId>>({});
  const [results, setResults] = useState<ClozeGapResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      const boot = resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore });
      if (boot.kind === 'restore') {
        const restored = boot.data;
        setGroupId(restored.groupId);
        setTitle(restored.title);
        setTextWithGaps(restored.text_with_gaps);
        setGaps(restored.gaps);
        setFramingText(restored.framingText);
        if (restored.results) {
          setResults(restored.results);
          setCorrectCount(restored.correctCount);
          setPhase('finished');
        } else {
          setPhase('ready');
        }
        return;
      }
      if (boot.kind === 'restore-failed') {
        setErrorMsg(t('fce.restoreFailed'));
        return;
      }

      setIsNewSession(true);
      const result = await generateFCEClozeAction();

      if (!result.ok) {
        setErrorMsg(result.code === 'no_content' ? t('fce.noContent') : t('fce.loadFailed'));
        return;
      }

      setGroupId(result.data.groupId);
      setTitle(result.data.title);
      setTextWithGaps(result.data.text_with_gaps);
      setGaps(result.data.gaps);
      setFramingText(result.data.framingText);
      setPhase('ready');
    }

    void init();
  }, [initialMessages, initialSessionId, t]);

  function handleSelect(gapNumber: number, optionId: 'A' | 'B' | 'C' | 'D') {
    setAnswers((prev) => ({ ...prev, [gapNumber]: optionId }));
  }

  async function handleSubmit() {
    setPhase('submitting');

    const result = await submitFCEClozeAnswersAction({ sessionId, groupId, answers });

    if (!result.ok) {
      setErrorMsg(t('fce.submitFailed'));
      setPhase('ready');
      return;
    }

    if (!sessionId) onSessionCreated?.(result.data.sessionId);
    setSessionId(result.data.sessionId);
    setResults(result.data.results);
    setCorrectCount(result.data.correctCount);
    setPhase('finished');
    onSessionFinished?.();
  }

  const review = results.length > 0 && gaps.length > 0 ? buildReview(gaps, results) : undefined;
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
                <GapText text={textWithGaps} mode="choice" />
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
              <GapText text={textWithGaps} mode="choice" review={review} />
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
