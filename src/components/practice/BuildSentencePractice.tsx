'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InfoCard } from '@/components/chat';
import { getBuildSentenceItemsAction } from '@/actions/modes/writing-build-sentence';
import { useClosedSetSubmit } from '@/hooks/useClosedSetSubmit';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreClosedSet, scoreClosedEntries, type ClosedEntryResult } from '@/lib/toefl/closed-set';
import type { ActivityRenderProps } from '@/lib/routing';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';

export interface BuildSentenceItem {
  id: string;
  prompt: string;
  tokens: string[];
  target_sentence: string;
}

export type BuildSentencePracticeProps = ActivityRenderProps;

interface ItemResult {
  correct: boolean;
  ordered_tokens: string[];
  expected: string;
}

function evaluate(ordered: string[], target: string): boolean {
  return scoreClosedEntries([{ id: '', selected: ordered.join(' '), expected: target, match: 'sentence' }])[0].correct;
}

function toItemResult(entry: ClosedEntryResult): ItemResult {
  return { correct: entry.correct, ordered_tokens: entry.selected.split(' '), expected: entry.expected };
}

/** TOEFL Writing, Build a Sentence: drag tokens into order, deterministic scoring. */
export function BuildSentencePractice({
  onBack,
  sessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: BuildSentencePracticeProps) {
  const t = useTranslations('resultcard');
  const tLoading = useTranslations('loading');
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId, tryRestore: (messages) => restoreClosedSet(messages) }),
  );
  const [items, setItems] = useState<BuildSentenceItem[]>([]);
  const [loading, setLoading] = useState(boot.kind === 'generate');
  const [loadError, setLoadError] = useState<string | null>(boot.kind === 'restore-failed' ? 'restore_failed' : null);
  const callbacks = useMemo(() => ({ sessionId, onSessionCreated, onSessionFinished }), [sessionId, onSessionCreated, onSessionFinished]);
  const { submit, error: submitError } = useClosedSetSubmit(callbacks);
  const [bankGroupId, setBankGroupId] = useState<string | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [bank, setBank] = useState<string[]>([]);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [result, setResult] = useState<ItemResult | null>(null);
  const [allResults, setAllResults] = useState<ItemResult[]>(() =>
    boot.kind === 'restore' ? boot.data.map(toItemResult) : [],
  );
  const [done, setDone] = useState(boot.kind === 'restore');

  useEffect(() => {
    if (boot.kind !== 'generate') return;
    async function init() {
      const res = await getBuildSentenceItemsAction();
      if (!res.ok) {
        setLoadError(res.code);
      } else {
        setItems(res.data.items);
        setBankGroupId(res.data.bankGroupId);
        if (res.data.items[0]) {
          setBank([...res.data.items[0].tokens].sort(() => Math.random() - 0.5));
        }
      }
      setLoading(false);
    }
    void init();
  }, [boot.kind]);

  function pickToken(token: string, bankIdx: number) {
    if (result) return;
    const newBank = [...bank];
    newBank.splice(bankIdx, 1);
    setBank(newBank);
    setOrdered([...ordered, token]);
  }

  function returnToken(token: string, orderedIdx: number) {
    if (result) return;
    const newOrdered = [...ordered];
    newOrdered.splice(orderedIdx, 1);
    setOrdered(newOrdered);
    setBank([...bank, token]);
  }

  function handleCheck() {
    if (result || !items[index]) return;
    const item = items[index];
    const correct = evaluate(ordered, item.target_sentence);
    const itemResult: ItemResult = { correct, ordered_tokens: [...ordered], expected: item.target_sentence };
    setResult(itemResult);
  }

  function submitAll(results: ItemResult[]) {
    void submit({
      mode: 'toefl_writing_build_sentence',
      bankGroupId,
      items,
      entries: items.map((item, index) => ({
        id: item.id,
        selected: results[index]?.ordered_tokens.join(' ') ?? '',
        expected: item.target_sentence,
        match: 'sentence' as const,
      })),
    });
  }

  function handleNext() {
    if (!result) return;
    const nextResults = [...allResults, result];
    setAllResults(nextResults);
    setResult(null);
    setOrdered([]);

    const nextIndex = index + 1;
    if (nextIndex >= items.length) {
      setDone(true);
      submitAll(nextResults);
    } else {
      setIndex(nextIndex);
      setBank([...items[nextIndex].tokens].sort(() => Math.random() - 0.5));
    }
  }

  if (loading) {
    return <BobMascotLoader message={tLoading('loadingActivity')} />;
  }

  if (loadError) {
    return <ActivityLoadError code={loadError} onBack={onBack} />;
  }

  if (done || items.length === 0) {
    const correct = allResults.filter((r) => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-6 py-10 max-w-xl mx-auto">
        <div className="text-4xl font-bold text-blue-600">{correct}/{allResults.length}</div>
        <p className="text-sm text-gray-500">{t('sentencesCorrect')}</p>
        {allResults.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-sm w-full">
            {r.correct
              ? <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
              : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
            <span className="text-gray-700">
              {t('yourAnswer')} <em>{r.ordered_tokens.join(' ')}</em>
              {!r.correct && <>, {t('expected')} <em>{r.expected}</em></>}
            </span>
          </div>
        ))}
        {submitError && (
          <button onClick={() => submitAll(allResults)} className="text-sm text-red-500 underline">{t('retrySave')}</button>
        )}
        <button onClick={onBack} className="mt-2 text-sm text-blue-600 underline">{t('done')}</button>
      </div>
    );
  }

  const item = items[index];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="flex flex-col gap-5 max-w-xl mx-auto w-full py-4"
      >
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {index + 1} / {items.length}
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed">
          {item.prompt}
        </div>

        <div className="min-h-12 flex flex-wrap gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-3">
          {ordered.length === 0 && (
            <span className="text-xs text-blue-300 self-center">{t('tapToBuild')}</span>
          )}
          {ordered.map((token, i) => (
            <button
              key={`ordered-${i}`}
              onClick={() => returnToken(token, i)}
              disabled={!!result}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-70 transition-colors"
            >
              {token}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {bank.map((token, i) => (
            <button
              key={`bank-${i}`}
              onClick={() => pickToken(token, i)}
              disabled={!!result}
              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {token}
            </button>
          ))}
        </div>

        {!result && (
          <button
            onClick={handleCheck}
            disabled={ordered.length === 0}
            className="py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {t('check')}
          </button>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <InfoCard title={result.correct ? t('correct') : t('notQuite')}>
              {result.correct
                ? <>{t('greatSentence')} <em>{ordered.join(' ')}</em></>
                : <>{t('correctSentence')} <em>{result.expected}</em></>}
            </InfoCard>
            <button
              onClick={handleNext}
              className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {index + 1 < items.length ? t('next') : t('seeResults')}
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
