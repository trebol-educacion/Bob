'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import { InfoCard } from '@/components/chat';
import { persistMessage } from '@/lib/persist-activity';
import type { WritingResponse, WritingFormativeFeedback } from '@/lib/types/practice';

/** Props for the generic WritingPractice activity component. */
export interface WritingPracticeProps {
  promptKey: string;
  instructions: string;
  targetWordCount: [number, number];
  bullets?: string[];
  sessionId: string;
  userId: string;
  onComplete?: (response: WritingResponse, feedback: WritingFormativeFeedback) => void;
  evaluateAction: (input: { text: string; sessionId: string; userId: string }) => Promise<WritingFormativeFeedback | { error: string }>;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

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
  const [text, setText] = useState('');
  const [startTime] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WritingFormativeFeedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef('');

  const saveDraft = useCallback(
    (currentText: string) => {
      if (currentText === lastSavedRef.current) return;
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
  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  async function handleSubmit() {
    if (submitting || feedback) return;
    setSubmitting(true);
    setSubmitError(null);

    const finalText = text;
    const finalWordCount = countWords(finalText);
    const timeSpentMs = Date.now() - startTime;

    const result = await evaluateAction({ text: finalText, sessionId, userId });

    if ('error' in result) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    persistMessage({
      sessionId,
      userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: result as unknown as Record<string, unknown>,
    }).catch((err: unknown) => {
      console.error('[WritingPractice] evaluation persist failed:', err);
    });

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

  if (feedback) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex flex-col gap-5 max-w-xl mx-auto w-full py-4"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={20} className="text-green-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">
            {feedback.understood ? 'Well done!' : 'Submitted — see feedback below'}
          </span>
        </div>

        {feedback.highlights.length > 0 && (
          <InfoCard title="Highlights">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {feedback.highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </InfoCard>
        )}

        {feedback.suggestions.length > 0 && (
          <InfoCard title="To improve">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </InfoCard>
        )}

        {feedback.model_answer && (
          <InfoCard title="Model answer">
            <p className="text-sm text-gray-700 whitespace-pre-line">{feedback.model_answer}</p>
          </InfoCard>
        )}

        <div className="flex gap-4 text-sm text-gray-500">
          <span>Words: <strong>{feedback.indicators.word_count}</strong></span>
          <span>Target: <strong>{feedback.indicators.target_word_count_range[0]}–{feedback.indicators.target_word_count_range[1]}</strong></span>
        </div>

        {(feedback.indicators.covered_bullets?.length ?? 0) > 0 && (
          <div className="text-sm text-green-700">
            Covered: {feedback.indicators.covered_bullets!.join(', ')}
          </div>
        )}
        {(feedback.indicators.missing_bullets?.length ?? 0) > 0 && (
          <div className="text-sm text-amber-700">
            Missing: {feedback.indicators.missing_bullets!.join(', ')}
          </div>
        )}
      </motion.div>
    );
  }

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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your answer here…"
        rows={10}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Words: <strong className={wordCount < minWords ? 'text-amber-500' : wordCount > maxWords ? 'text-red-400' : 'text-green-600'}>{wordCount}</strong> / {minWords}–{maxWords}
        </span>
        <span>{minutes}:{String(seconds).padStart(2, '0')}</span>
      </div>

      <AnimatePresence>
        {submitError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500"
          >
            {submitError} — please try again.
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={handleSubmit}
        disabled={submitting || wordCount < minWords}
        className="py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {submitting ? 'Evaluating…' : 'Submit'}
      </button>

      {wordCount < minWords && (
        <p className="text-xs text-gray-400 text-center">
          {minWords - wordCount} more word{minWords - wordCount !== 1 ? 's' : ''} needed to submit.
        </p>
      )}
    </div>
  );
}
