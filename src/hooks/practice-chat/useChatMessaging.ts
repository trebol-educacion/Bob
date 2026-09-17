'use client';

import { useCallback, useState } from 'react';
import type React from 'react';
import { saveMessageAction } from '@/actions/messages';
import type { ChatMsg } from './types';

export type SaveMsg = (
  input: Omit<Parameters<typeof saveMessageAction>[0], 'session_id'>,
) => Promise<void>;

interface Params {
  sessionIdRef: React.RefObject<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
}

export function useChatMessaging({ sessionIdRef, setMessages }: Params) {
  const [saveError, setSaveError] = useState<string | null>(null);

  const addBobMessage = useCallback((content: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bob', content }]);
  }, [setMessages]);

  const addUserMessage = useCallback((content: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
  }, [setMessages]);

  const saveMsg = useCallback<SaveMsg>(async (input) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const { error } = await saveMessageAction({ ...input, session_id: sid });
    if (error) {
      console.error('[saveMsg] failed:', error, 'msg_type:', input.msg_type);
      setSaveError(`Error saving message (${input.msg_type})`);
      setTimeout(() => setSaveError(null), 4000);
    }
  }, [sessionIdRef]);

  return { saveError, addBobMessage, addUserMessage, saveMsg };
}
