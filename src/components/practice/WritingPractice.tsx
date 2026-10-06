'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { WritingFeedbackView } from '@/components/practice/writing/WritingFeedbackView';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { countWords } from '@/lib/writing/word-count';
import { persistMessage } from '@/lib/persist-activity';
import type { WritingResponse, WritingFormativeFeedback } from '@/lib/types/practice';

/** Props for the generic WritingPractice activity component. */
export interface WritingPracticeBaseProps {
  promptKey: string;
  instructions: string;
  targetWordCount: [number, number];
  bullets?: string[];
  onComplete?: (response: WritingResponse, feedback: WritingFormativeFeedback) => void;
}

type EvaluateResult = Promise<WritingFormativeFeedback | { error: string }>;

export interface WritingSessionProps {
  sessionId: string;
  userId: string;
  evaluateAction: (input: { text: string; sessionId: string; userId: string }) => EvaluateResult;
}

export interface WritingSessionlessProps {
  sessionId?: undefined;
  userId?: undefined;
  evaluateAction: (input: { text: string }) => EvaluateResult;
}

export type WritingPracticeProps = WritingPracticeBaseProps & (WritingSessionProps | WritingSessionlessProps);

/** Reusable open writing activity with live word count, auto-save draft, and formative feedback. */
export function WritingPractice({
  instructions,
  targetWordCount,
  bullets,
  sessionId,
  userId,
  onComplete,
  evaluateAction,
}: WritingPracticeProps) {
  const t = useTranslations('resultcard');
  const tErrors = useTranslations('errors');
  const [text, setText] = useState('');
  const [startTime] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WritingFormativeFeedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef('');

  const saveDraft = useCallback(
    (currentText: string) => {
      if (!sessionId || !userId || currentText === lastSavedRef.current) return;
      lastSavedRef.current = currentText;
      persistMessage({
        sessionId,
        userId,
        role: 'user',
        msgType: 'text',
        contentJson: { kind: 'writing_draft', text: currentText },
      }).catch((err: unknown) => {
        console.error('[WritingPractice] draft persist failed:', err);
      });
    },
    [sessionId, userId]
  );

  useEffect(() => {
    draftTimerRef.current = setInterval(() => {
      saveDraft(text);
    }, 5000);
    return () => {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
    };
  }, [text, saveDraft]);

  const wordCount = countWords(text);
  const [minWords, maxWords] = targetWordCount;

  async function handleSubmit() {
    if (submitting || feedback) return;
    setSubmitting(true);
    setSubmitError(null);

    const finalText = text;
    const finalWordCount = countWords(finalText);
    const timeSpentMs = Date.now() - startTime;

    const evaluate = evaluateAction as (input: { text: string; sessionId?: string; userId?: string }) => EvaluateResult;
    const result = await evaluate({ text: finalText, sessionId, userId });

    if ('error' in result) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    if (sessionId && userId) {
      persistMessage({
        sessionId,
        userId,
        role: 'bob',
        msgType: 'evaluation',
        contentJson: result as unknown as Record<string, unknown>,
      }).catch((err: unknown) => {
        console.error('[WritingPractice] evaluation persist failed:', err);
      });
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
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full py-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed">
        {instructions}
      </div>

      {bullets && bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 pl-1">
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}

      <ChatInputBar
        variant="text"
        value={text}
        placeholder={t('writeAnswerPlaceholder')}
        disabled={submitting}
        sendDisabled={wordCount < minWords}
        onChange={setText}
        onSend={handleSubmit}
      />

      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>
          {t('words')} <strong className={wordCount < minWords ? 'text-amber-500' : wordCount > maxWords ? 'text-red-400' : 'text-green-600'}>{wordCount}</strong> / {minWords}-{maxWords}
        </span>
        <span>{minutes}:{String(seconds).padStart(2, '0')}</span>
      </div>

      {submitting && (
        <p className="text-sm text-gray-500 text-center" role="status">{t('reviewingText')}</p>
      )}

      <AnimatePresence>
        {submitError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500"
          >
            {tErrors('tryAgain', { message: submitError })}
          </motion.p>
        )}
      </AnimatePresence>

      {wordCount < minWords && (
        <p className="text-xs text-gray-400 text-center">
          {t('moreWordsNeeded', { n: minWords - wordCount })}
        </p>
      )}
    </div>
  );
}
