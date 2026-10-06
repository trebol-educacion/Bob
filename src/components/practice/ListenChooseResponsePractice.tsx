'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getClosedItemsAction } from '@/actions/modes/listen-choose-response';
import { ClosedComprehension } from '@/components/practice/ClosedComprehension';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { useClosedSetSubmit } from '@/hooks/useClosedSetSubmit';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreClosedSet } from '@/lib/toefl/closed-set';
import { useTranslations } from 'next-intl';
import type { ActivityRenderProps } from '@/lib/routing';
import type { ClosedEvaluation, ClosedItem } from '@/lib/types/practice';

const MODE = 'toefl_listen_choose_response';

/** Wrapper that loads TOEFL Listen-Choose-a-Response items, opens the session on the final submit and restores finished sessions. */
export function ListenChooseResponsePractice({
  onBack,
  sessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: ActivityRenderProps) {
  const tErrors = useTranslations('errors');
  const tLoading = useTranslations('loading');
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId, tryRestore: (messages) => restoreClosedSet(messages) }),
  );
  const [items, setItems] = useState<ClosedItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const callbacks = useMemo(() => ({ sessionId, onSessionCreated, onSessionFinished }), [sessionId, onSessionCreated, onSessionFinished]);
  const { submit, error: submitError } = useClosedSetSubmit(callbacks);
  const msgNoItems = tErrors('noItemsAvailable');

  useEffect(() => {
    if (boot.kind !== 'generate') return;
    async function init() {
      const result = await getClosedItemsAction({ framework: 'toefl', exam_part: 'listen_choose_response', cefr_level: 'b1' });
      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }
      if (result.items.length === 0) {
        setErrorMsg(msgNoItems);
        return;
      }
      setItems(result.items);
    }
    void init();
  }, [boot.kind, msgNoItems]);

  function handleFinish(results: ClosedEvaluation[]) {
    if (!items) return;
    void submit({
      mode: MODE,
      items,
      entries: items.map((item, index) => ({
        id: item.variant_id,
        selected: results[index]?.selected ?? '',
        expected: item.correct_key,
        explanation: item.explanation,
        match: 'key' as const,
      })),
    });
  }

  if (boot.kind === 'restore') {
    const restored: ClosedEvaluation[] = boot.data.map((entry) => ({ kind: 'closed', ...entry }));
    return <ClosedComprehension items={[]} initialResults={restored} onDone={onBack} />;
  }

  if (errorMsg || boot.kind === 'restore-failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-red-500 font-semibold">{errorMsg ?? tErrors('couldNotLoadItems')}</p>
        <button
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  if (!items) {
    return <BobMascotLoader message={tLoading('loadingListening')} />;
  }

  return <ClosedComprehension items={items} submitError={submitError} onFinish={handleFinish} onDone={onBack} />;
}
