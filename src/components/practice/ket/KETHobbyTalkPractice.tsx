'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETHobbyTalkPlanAction,
  generateKETHobbyTalkMediaAction,
  evaluateKETHobbyTalkAction,
  type HobbyTalkPlan,
  type HobbyTalkMedia,
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

interface RestoredPlan {
  hobby: string;
  instruction: string;
  bullet_points: string[];
  image_prompt: string;
  image_url: string;
}

function tryRestore(messages: StoredMessage[]): RestoredPlan | null {
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (cj?.kind === 'hobby_talk_prompt') {
      return {
        hobby: String(cj.hobby ?? ''),
        instruction: String(cj.instruction ?? ''),
        bullet_points: (cj.bullet_points as string[]) ?? [],
        image_prompt: String(cj.image_prompt ?? ''),
        image_url: String(cj.image_url ?? ''),
      };
    }
  }
  return null;
}

const EMPTY_MEDIA: HobbyTalkMedia = {
  instruction_audio_b64: '',
  instruction_audio_mime: 'audio/L16;codec=pcm;rate=24000',
  image_url: '',
};

/** KET Speaking Part 2 — Talk About a Hobby (two-phase loading). */
export function KETHobbyTalkPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETHobbyTalkPracticeProps) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<HobbyTalkPlan | null>(null);
  const [media, setMedia] = useState<HobbyTalkMedia>(EMPTY_MEDIA);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initRef = useRef(false);

  async function loadMedia(p: HobbyTalkPlan) {
    setMediaLoading(true);
    const m = await generateKETHobbyTalkMediaAction({
      instruction: p.instruction,
      image_prompt: p.image_prompt,
      sessionId: p.sessionId,
    }).catch(() => EMPTY_MEDIA);
    setMedia(m);
    setMediaLoading(false);
  }

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (initialMessages?.length) {
        const r = tryRestore(initialMessages);
        if (r) {
          const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
          const { data: { user } } = await createSupabaseBrowser().auth.getUser();
          const p: HobbyTalkPlan = {
            sessionId: initialSessionId ?? '', userId: user?.id ?? '',
            hobby: r.hobby, instruction: r.instruction, bullet_points: r.bullet_points, image_prompt: r.image_prompt,
          };
          setPlan(p);
          if (r.image_url) setMedia({ instruction_audio_b64: '', instruction_audio_mime: 'audio/L16;codec=pcm;rate=24000', image_url: r.image_url });
          else if (initialSessionId) void loadMedia(p);
          setLoading(false);
          return;
        }
      }
      if (initialSessionId) { setLoading(false); return; }

      const result = await generateKETHobbyTalkPlanAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); setLoading(false); return; }
      onSessionCreated?.(result.sessionId);
      setPlan(result);
      setLoading(false);
      void loadMedia(result);
    }
    void init();
  }, []);

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">Back</button>
    </div>
  );

  if (loading || !plan) return <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing speaking exercise…" /></div>;

  return (
    <KETSpeakingPractice
      partLabel="Part 2"
      title="Talk About a Hobby"
      recordingSeconds={30}
      instructionAudioB64={media.instruction_audio_b64}
      instructionAudioMime={media.instruction_audio_mime}
      instructionText={plan.instruction}
      bulletPoints={plan.bullet_points}
      imageUrl={media.image_url || undefined}
      mediaLoading={mediaLoading}
      imageRequired={false}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETHobbyTalkAction({
          sessionId: plan.sessionId,
          userId: plan.userId,
          audioBase64: base64,
          audioMime: mime,
          hobby: plan.hobby,
          bullet_points: plan.bullet_points,
        });
        if (!('error' in result)) onSessionFinished?.();
        return result;
      }}
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    />
  );
}
