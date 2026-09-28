'use client';

import React, { useEffect, useRef } from 'react';
import { ImageConfigSelection, type SceneConfig } from '@/components/ImageConfigSelection';
import type { SaveMsg } from './useChatMessaging';

interface Params {
  mode: 'situation' | 'image';
  isHistory: boolean;
  addBobMessage: (content: React.ReactNode) => void;
  saveMsg: SaveMsg;
  onImageConfig: (config: SceneConfig) => void;
}

export function useInitialGreeting({ mode, isHistory, addBobMessage, saveMsg, onImageConfig }: Params) {
  const greetingAddedRef = useRef(false);

  useEffect(() => {
    if (isHistory || greetingAddedRef.current) return;
    greetingAddedRef.current = true;
    if (mode === 'situation') {
      addBobMessage(
        <p>
          Hi! I&apos;m <strong>BOB</strong>, your pronunciation coach. What situation would you like to practice today?
          <br />
          <span className="text-trebol-text/60 text-sm">
            E.g. &quot;In a job interview&quot; or &quot;Asking for directions on the street&quot;.
          </span>
        </p>
      );
      saveMsg({
        role: 'bob',
        msg_type: 'text',
        content_text: "Hi! I'm BOB, your pronunciation coach. What situation would you like to practice today?",
      });
    } else {
      addBobMessage(
        <div className="space-y-3">
          <p>Let&apos;s practice image description! Configure your scene:</p>
          <ImageConfigSelection onConfirm={onImageConfig} />
        </div>
      );
      saveMsg({
        role: 'bob',
        msg_type: 'text',
        content_text: "Let's practice image description! Configure your scene:",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
