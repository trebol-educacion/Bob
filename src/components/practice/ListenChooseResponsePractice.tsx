'use client';

import React, { useEffect, useState } from 'react';
import { getClosedItemsAction } from '@/actions/modes/listen-choose-response';
import { ClosedComprehension } from '@/components/practice/ClosedComprehension';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { createSessionAction } from '@/actions/sessions';
import { useTranslations } from 'next-intl';
import type { ClosedItem } from '@/lib/types/practice';

interface ListenChooseResponsePracticeProps {
  onBack: () => void;
}

/** Wrapper that loads TOEFL Listen-Choose-a-Response items and renders ClosedComprehension. */
export function ListenChooseResponsePractice({ onBack }: ListenChooseResponsePracticeProps) {
  const tErrors = useTranslations('errors');
  const tLoading = useTranslations('loading');
  const [items, setItems] = useState<ClosedItem[] | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const msgFailedSession = tErrors('failedCreateSession');
  const msgNoItems = tErrors('noItemsAvailable');

  useEffect(() => {
    async function init() {
      const sessionResult = await createSessionAction({
        mode: 'toefl_listen_choose_response',
        title: 'TOEFL Listening — Choose a Response',
      });

      if (!sessionResult.data) {
        setErrorMsg(sessionResult.error ?? msgFailedSession);
        return;
      }

      setSessionId(sessionResult.data.id);
      setUserId(sessionResult.data.user_id);

      const result = await getClosedItemsAction({
        framework: 'toefl',
        exam_part: 'listen_choose_response',
        cefr_level: 'b1',
      });

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
  }, [msgFailedSession, msgNoItems]);

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
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

  return (
    <ClosedComprehension
      items={items}
      sessionId={sessionId}
      userId={userId}
      onComplete={onBack}
    />
  );
}
