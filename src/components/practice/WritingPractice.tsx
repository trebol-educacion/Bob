'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { WritingFeedbackView } from '@/components/practice/writing/WritingFeedbackView';
import { WritingComposer } from '@/components/practice/writing/WritingComposer';
import { countWords } from '@/lib/writing/word-count';
import type { WritingResponse, WritingFormativeFeedback } from '@/lib/types/practice';

/** Props for the generic WritingPractice activity component. */
export interface WritingPracticeBaseProps {
  promptKey: string;
  instructions: string;
  targetWordCount: [number, number];
  bullets?: string[];
  lead?: React.ReactNode;
  initialText?: string;
  initialFeedback?: WritingFormativeFeedback | null;
  onComplete?: (response: WritingResponse, feedback: WritingFormativeFeedback) => void;
}

type EvaluateResult = Promise<WritingFormativeFeedback | { error: string }>;

export interface WritingEvaluationProps {
  evaluateAction: (input: { text: string }) => EvaluateResult;
}

export type WritingPracticeProps = WritingPracticeBaseProps & WritingEvaluationProps;

/** Reusable open writing activity with live word count and formative feedback; persistence is the caller's job. */
export function WritingPractice({
  instructions,
  targetWordCount,
  bullets,
  lead,
  initialText,
  initialFeedback,
  onComplete,
  evaluateAction,
}: WritingPracticeProps) {
  const t = useTranslations('resultcard');
  const tErrors = useTranslations('errors');
  const [text, setText] = useState(initialText ?? '');
  const [startTime] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WritingFormativeFeedback | null>(initialFeedback ?? null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const wordCount = countWords(text);
  const [minWords, maxWords] = targetWordCount;

  async function handleSubmit() {
    if (submitting || feedback) return;
    setSubmitting(true);
    setSubmitError(null);

    const finalText = text;
    const finalWordCount = countWords(finalText);
    const timeSpentMs = Date.now() - startTime;

    const result = await evaluateAction({ text: finalText });

    if ('error' in result) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    setFeedback(result);
    setSubmitting(false);

    const response: WritingResponse = { text: finalText, word_count: finalWordCount, time_spent_ms: timeSpentMs };
    onComplete?.(response, result);
  }

  const [timerDisplay, setTimerDisplay] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTimerDisplay(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  const minutes = Math.floor(timerDisplay / 60);
  const seconds = timerDisplay % 60;

  if (feedback) return <WritingFeedbackView feedback={feedback} />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full py-4">
          {lead}
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed">
            {instructions}
          </div>
          {bullets && bullets.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 pl-1">
              {bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          <p className="text-xs text-gray-400 text-right">{minutes}:{String(seconds).padStart(2, '0')}</p>
          {submitting && (
            <p className="text-sm text-gray-500 text-center" role="status">{t('reviewingText')}</p>
          )}
        </div>
      </div>
      <WritingComposer
        value={text}
        placeholder={t('writeAnswerPlaceholder')}
        wordCount={wordCount}
        minWords={minWords}
        maxWords={maxWords}
        target={`/ ${minWords}-${maxWords}`}
        disabled={submitting}
        error={submitError ? tErrors('tryAgain', { message: submitError }) : null}
        onChange={setText}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
