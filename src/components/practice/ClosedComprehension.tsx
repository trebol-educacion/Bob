'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InfoCard } from '@/components/chat';
import { persistMessage } from '@/lib/persist-activity';
import type { ClosedItem, ClosedEvaluation } from '@/lib/types/practice';

/** Props for the ClosedComprehension activity component. */
export interface ClosedComprehensionProps {
  items: ClosedItem[];
  sessionId: string;
  userId: string;
  onComplete?: (results: ClosedEvaluation[]) => void;
}

/** Generic closed-comprehension activity — listening, reading, or image-based. Deterministic scoring; no LLM involved. */
export function ClosedComprehension({ items, sessionId, userId, onComplete }: ClosedComprehensionProps) {
  const t = useTranslations('resultcard');
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<ClosedEvaluation | null>(null);
  const [results, setResults] = useState<ClosedEvaluation[]>([]);
  const [done, setDone] = useState(false);

  const item = items[index];

  if (!item || done) {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <div className="text-5xl font-bold text-blue-600">{correct}/{results.length}</div>
        <p className="text-gray-600 text-sm">{t('correctAnswers')}</p>
        {results.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {r.correct
              ? <CheckCircle size={16} className="text-green-500 shrink-0" />
              : <XCircle size={16} className="text-red-400 shrink-0" />}
            <span className="text-gray-700">
              {t('youChose')} <strong>{r.selected}</strong>
              {!r.correct && <> — {t('expected')} <strong>{r.expected}</strong></>}
            </span>
          </div>
        ))}
      </div>
    );
  }

  async function handleSelect(key: string) {
    if (answered) return;

    const evaluation: ClosedEvaluation = {
      kind: 'closed',
      correct: key === item.correct_key,
      selected: key,
      expected: item.correct_key,
      explanation: item.explanation,
    };

    setAnswered(evaluation);

    persistMessage({
      sessionId,
      userId,
      role: 'user',
      msgType: 'text',
      contentText: key,
      contentJson: { variant_id: item.variant_id, kind: 'closed_answer' },
    }).catch((err: unknown) => {
      console.error('[ClosedComprehension] persist user answer failed:', err);
    });

    persistMessage({
      sessionId,
      userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: evaluation as unknown as Record<string, unknown>,
    }).catch((err: unknown) => {
      console.error('[ClosedComprehension] persist evaluation failed:', err);
    });
  }

  function handleNext() {
    if (!answered) return;

    const nextResults = [...results, answered];
    setResults(nextResults);
    setAnswered(null);

    if (index + 1 >= items.length) {
      setDone(true);
      onComplete?.(nextResults);
    } else {
      setIndex(index + 1);
    }
  }

  const selectedLabel = answered
    ? item.options.find((o) => o.key === answered.selected)?.label
    : null;

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

        {item.stimulus_audio_url && (
          <audio controls src={item.stimulus_audio_url} className="w-full rounded-lg" />
        )}

        {item.stimulus_image_url && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-100">
            <Image
              src={item.stimulus_image_url}
              alt="stimulus"
              fill
              className="object-contain"
            />
          </div>
        )}

        {item.stimulus_text && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed">
            {item.stimulus_text}
          </div>
        )}

        <p className="text-base font-semibold text-gray-800">{item.question}</p>

        <div className="flex flex-col gap-2">
          {item.options.map((opt) => {
            const isSelected = answered?.selected === opt.key;
            const isCorrect = opt.key === item.correct_key;

            let baseClass =
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer';

            if (answered) {
              if (isCorrect) {
                baseClass += ' bg-green-50 border-green-300 text-green-800';
              } else if (isSelected) {
                baseClass += ' bg-red-50 border-red-300 text-red-700';
              } else {
                baseClass += ' bg-white border-gray-100 text-gray-500 cursor-default';
              }
            } else {
              baseClass += ' bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300';
            }

            return (
              <button
                key={opt.key}
                className={baseClass}
                onClick={() => handleSelect(opt.key)}
                disabled={!!answered}
              >
                <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs shrink-0">
                  {opt.key.toUpperCase()}
                </span>
                {opt.image_url ? (
                  <div className="relative w-16 h-10 rounded overflow-hidden shrink-0">
                    <Image src={opt.image_url} alt={opt.label} fill className="object-cover" />
                  </div>
                ) : (
                  <span>{opt.label}</span>
                )}
                {answered && isCorrect && <CheckCircle size={14} className="ml-auto text-green-500" />}
                {answered && isSelected && !isCorrect && <XCircle size={14} className="ml-auto text-red-400" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <InfoCard title={answered.correct ? t('correct') : t('theAnswerIs', { key: answered.expected.toUpperCase() })}>
              {answered.correct
                ? <>{t('wellDoneChose', { label: selectedLabel ?? answered.selected })}</>
                : <>{t('choseWrong', { label: selectedLabel ?? answered.selected })} {answered.explanation ?? ''}</>}
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
