'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETHobbyTalkAction,
  evaluateKETHobbyTalkAction,
  type HobbyTalkPrompt,
} from '@/actions/modes/ket-speaking-part2';
import type { StoredMessage } from '@/actions/messages';

export interface KETHobbyTalkPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

function tryRestore(messages: StoredMessage[]): HobbyTalkPrompt | null {
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (cj?.kind === 'hobby_talk_prompt') {
      return {
        sessionId: '', userId: '',
        hobby: String(cj.hobby ?? ''),
        instruction: String(cj.instruction ?? ''),
        instruction_audio_b64: '',
        instruction_audio_mime: 'audio/L16;codec=pcm;rate=24000',
        bullet_points: (cj.bullet_points as string[]) ?? [],
        image_url: String(cj.image_url ?? ''),
      };
    }
  }
  return null;
}

/** KET Speaking Part 2 — Talk About a Hobby. */
export function KETHobbyTalkPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETHobbyTalkPracticeProps) {
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<HobbyTalkPrompt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (initialMessages?.length) {
        const r = tryRestore(initialMessages);
        if (r) { setPrompt(r); setLoading(false); return; }
      }
      if (initialSessionId) { setLoading(false); return; }

      const result = await generateKETHobbyTalkAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); setLoading(false); return; }
      onSessionCreated?.(result.sessionId);
      setPrompt(result);
      setLoading(false);
    }
    void init();
  }, []);

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">Back</button>
    </div>
  );

  if (loading || !prompt) return <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing speaking exercise…" /></div>;

  return (
    <KETSpeakingPractice
      partLabel="Part 2"
      title="Talk About a Hobby"
      recordingSeconds={30}
      instructionAudioB64={prompt.instruction_audio_b64}
      instructionAudioMime={prompt.instruction_audio_mime}
      instructionText={prompt.instruction}
      bulletPoints={prompt.bullet_points}
      imageUrl={prompt.image_url || undefined}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETHobbyTalkAction({
          sessionId: prompt.sessionId,
          userId: prompt.userId,
          audioBase64: base64,
          audioMime: mime,
          hobby: prompt.hobby,
          bullet_points: prompt.bullet_points,
        });
        if (!('error' in result)) onSessionFinished?.();
        return result;
      }}
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    />
  );
}
