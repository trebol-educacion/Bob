'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { InfoCard } from '@/components/chat';
import { persistMessage } from '@/lib/persist-activity';
import { getBuildSentenceItemsAction } from '@/actions/modes/writing-build-sentence';
import { createSessionAction } from '@/actions/sessions';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';

export interface BuildSentenceItem {
  id: string;
  prompt: string;
  tokens: string[];
  target_sentence: string;
}

/** Props for the deterministic Build-a-Sentence activity (TOEFL Writing). */
export interface BuildSentencePracticeProps {
  onBack: () => void;
}

interface ItemResult {
  correct: boolean;
  ordered_tokens: string[];
  expected: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function evaluate(ordered: string[], target: string): boolean {
  return normalize(ordered.join(' ')) === normalize(target);
}

/** TOEFL Writing — Build a Sentence: drag tokens into order, deterministic scoring. */
export function BuildSentencePractice({ onBack }: BuildSentencePracticeProps) {
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [items, setItems] = useState<BuildSentenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [bank, setBank] = useState<string[]>([]);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [result, setResult] = useState<ItemResult | null>(null);
  const [allResults, setAllResults] = useState<ItemResult[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function init() {
      const sessionResult = await createSessionAction({
        mode: 'toefl_writing_build_sentence',
        title: 'TOEFL Writing — Build a Sentence',
      });
      if (!sessionResult.data) {
        setLoadError(sessionResult.error ?? 'Failed to create session');
        setLoading(false);
        return;
      }
      setSessionId(sessionResult.data.id);
      setUserId(sessionResult.data.user_id);

      const res = await getBuildSentenceItemsAction();
      if ('error' in res) {
        setLoadError(res.error);
      } else {
        setItems(res.items);
        if (res.items[0]) {
          setBank([...res.items[0].tokens].sort(() => Math.random() - 0.5));
        }
      }
      setLoading(false);
    }
    void init();
  }, []);

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

    persistMessage({
      sessionId,
      userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: { kind: 'closed', correct, selected: ordered.join(' '), expected: item.target_sentence },
    }).catch((err: unknown) => {
      console.error('[BuildSentencePractice] evaluation persist failed:', err);
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
    } else {
      setIndex(nextIndex);
      setBank([...items[nextIndex].tokens].sort(() => Math.random() - 0.5));
    }
  }

  if (loading) {
    return <BobMascotLoader message="Loading activity…" />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-sm text-red-500">Could not load items. Please try again.</p>
        <button onClick={onBack} className="text-sm text-blue-600 underline">Go back</button>
      </div>
    );
  }

  if (done || items.length === 0) {
    const correct = allResults.filter((r) => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-6 py-10 max-w-xl mx-auto">
        <div className="text-4xl font-bold text-blue-600">{correct}/{allResults.length}</div>
        <p className="text-sm text-gray-500">sentences built correctly</p>
        {allResults.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-sm w-full">
            {r.correct
              ? <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
              : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
            <span className="text-gray-700">
              Your answer: <em>{r.ordered_tokens.join(' ')}</em>
              {!r.correct && <> — expected: <em>{r.expected}</em></>}
            </span>
          </div>
        ))}
        <button onClick={onBack} className="mt-2 text-sm text-blue-600 underline">Done</button>
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
            <span className="text-xs text-blue-300 self-center">Tap tokens below to build the sentence…</span>
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
            Check
          </button>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <InfoCard title={result.correct ? 'Correct!' : 'Not quite'}>
              {result.correct
                ? <>Great sentence: <em>{ordered.join(' ')}</em></>
                : <>Correct sentence: <em>{result.expected}</em></>}
            </InfoCard>
            <button
              onClick={handleNext}
              className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {index + 1 < items.length ? 'Next' : 'See results'}
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
