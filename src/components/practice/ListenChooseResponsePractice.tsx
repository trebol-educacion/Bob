'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getClosedItemsAction } from '@/actions/modes/listen-choose-response';
import { ClosedComprehension } from '@/components/practice/ClosedComprehension';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
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
  const tLoading = useTranslations('loading');
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId, tryRestore: (messages) => restoreClosedSet(messages) }),
  );
  const [items, setItems] = useState<ClosedItem[] | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(boot.kind === 'restore-failed' ? 'restore_failed' : null);
  const [bankGroupId, setBankGroupId] = useState<string | undefined>(undefined);
  const callbacks = useMemo(() => ({ sessionId, onSessionCreated, onSessionFinished }), [sessionId, onSessionCreated, onSessionFinished]);
  const { submit, error: submitError } = useClosedSetSubmit(callbacks);

  useEffect(() => {
    if (boot.kind !== 'generate') return;
    async function init() {
      const result = await getClosedItemsAction();
      if (!result.ok) {
        setLoadErrorCode(result.code);
        return;
      }
      setBankGroupId(result.data.bankGroupId);
      setItems(result.data.items);
    }
    void init();
  }, [boot.kind]);

  function handleFinish(results: ClosedEvaluation[]) {
    if (!items) return;
    void submit({
      mode: MODE,
      bankGroupId,
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

  if (loadErrorCode) return <ActivityLoadError code={loadErrorCode} onBack={onBack} />;

  if (!items) {
    return <BobMascotLoader message={tLoading('loadingListening')} />;
  }

  return <ClosedComprehension items={items} submitError={submitError} onFinish={handleFinish} onDone={onBack} />;
}
