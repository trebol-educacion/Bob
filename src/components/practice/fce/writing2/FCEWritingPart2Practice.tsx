'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FCEWritingIcon } from '@/components/icons/FCEIcons';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { WritingPractice } from '@/components/practice/WritingPractice';
import { WritingFeedbackView } from '@/components/practice/writing/WritingFeedbackView';
import { TaskChooser } from '@/components/practice/fce/writing2/TaskChooser';
import { restoreFcePart2 } from '@/components/practice/fce/writing2/restore';
import { startFCEWritingPart2Action, submitFCEWritingPart2Action } from '@/actions/modes/fce-writing-part2';
import type { StoredMessage } from '@/actions/messages';
import type { WritingFormativeFeedback } from '@/lib/types/practice';
import { FCE_PART2_WORD_RANGE, type FcePart2Plan } from '@/lib/writing/fce-part2';

export interface FCEWritingPart2PracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'choosing' | 'writing' | 'finished';

export function FCEWritingPart2Practice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: FCEWritingPart2PracticeProps) {
  const t = useTranslations('cambridge');
  const [restored] = useState(() =>
    initialMessages && initialMessages.length > 0 ? restoreFcePart2(initialMessages) : null,
  );
  const [phase, setPhase] = useState<Phase>(() => {
    if (!restored?.plan) return 'loading';
    return restored.feedback ? 'finished' : 'choosing';
  });
  const [plan, setPlan] = useState<FcePart2Plan | null>(restored?.plan ?? null);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [taskNumber, setTaskNumber] = useState<number | null>(restored?.feedback ? restored.taskNumber : null);
  const [feedback, setFeedback] = useState<WritingFormativeFeedback | null>(restored?.feedback ?? null);
  const [submittedText, setSubmittedText] = useState(restored?.feedback ? (restored.text ?? '') : '');
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    initialSessionId && !restored?.plan ? t('fce.restoreFailed') : null,
  );
  const initStartedRef = useRef(false);

  const openNewSession = useCallback(async () => {
    setErrorMsg(null);
    setPhase('loading');
    const result = await startFCEWritingPart2Action();
    if ('error' in result) {
      setErrorMsg(result.error);
      return;
    }
    setPlan(result);
    setPhase('choosing');
  }, []);

  useEffect(() => {
    if (initStartedRef.current || restored?.plan || initialSessionId) return;
    initStartedRef.current = true;
    void openNewSession();
  }, [restored, initialSessionId, openNewSession]);

  const chosenTask = plan?.tasks.find((task) => task.number === taskNumber) ?? null;

  const evaluate = useCallback(
    async (input: { text: string }): Promise<WritingFormativeFeedback | { error: string }> => {
      if (taskNumber === null || !plan) return { error: 'No task selected' };
      const result = await submitFCEWritingPart2Action({ sessionId, plan, taskNumber, text: input.text });
      if ('error' in result) return result;
      if (!sessionId) {
        setSessionId(result.sessionId);
        onSessionCreated?.(result.sessionId);
      }
      setSubmittedText(input.text);
      onSessionFinished?.();
      return result.feedback;
    },
    [taskNumber, plan, sessionId, onSessionCreated, onSessionFinished],
  );

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void openNewSession()}
            className="px-5 py-2 bg-bob-brand text-white rounded-xl font-semibold text-sm"
          >
            {t('fce.writing2.retry')}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
          >
            {t('fce.writing2.back')}
          </button>
        </div>
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
          aria-label={t('fce.writing2.back')}
        >
          ←
        </button>
        <FCEWritingIcon size={18} className="text-bob-brand" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('fce.writing2.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('fce.writing2.headerSubtitle')}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-bob-brand text-[10px] font-bold uppercase tracking-widest bg-bob-brand/10">
          {t('fce.writing2.partBadge')}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.writing2.preparingExercise')} />
        </div>
      )}

      {phase === 'choosing' && plan && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-start gap-2">
            <BobAvatar />
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
              {plan.framingText}
            </div>
          </div>
          <p className="text-sm font-bold text-gray-800">{t('fce.writing2.chooseTitle')}</p>
          <p className="text-xs text-gray-500">{t('fce.writing2.chooseHint')}</p>
          <TaskChooser
            tasks={plan.tasks}
            onChoose={(number) => {
              setTaskNumber(number);
              setPhase('writing');
            }}
          />
        </div>
      )}

      {phase === 'writing' && chosenTask && (
        <div className="flex-1 overflow-y-auto px-4">
          <button
            type="button"
            onClick={() => setPhase('choosing')}
            className="mt-3 text-xs font-semibold text-gray-400 hover:text-gray-600"
          >
            {t('fce.writing2.changeTask')}
          </button>
          <WritingPractice
            promptKey="cambridge_fce_writing_part2_b2_evaluation"
            instructions={`${t(`fce.writing2.types.${chosenTask.taskType}`)}: ${chosenTask.situation}`}
            targetWordCount={FCE_PART2_WORD_RANGE}
            evaluateAction={evaluate}
            onComplete={(_response, result) => {
              setFeedback(result);
              setPhase('finished');
            }}
          />
        </div>
      )}

      {phase === 'finished' && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {chosenTask && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {t(`fce.writing2.types.${chosenTask.taskType}`)}
              </p>
              <p className="text-sm text-gray-700">{chosenTask.situation}</p>
            </div>
          )}
          {submittedText && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                {t('fce.writing2.yourText')}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{submittedText}</p>
            </div>
          )}
          <WritingFeedbackView feedback={feedback} />
        </div>
      )}
    </div>
  );
}
