'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETPictureDescPlanAction,
  generateKETPictureDescMediaAction,
  evaluateKETPictureDescAction,
  type PictureDescPlan,
  type PictureDescMedia,
} from '@/actions/modes/ket-speaking-part3';
import type { StoredMessage } from '@/actions/messages';

export interface KETDescribePicturePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

interface RestoredPlan {
  scene_description: string;
  instruction: string;
  image_prompt: string;
  image_url: string;
}

function tryRestore(messages: StoredMessage[]): RestoredPlan | null {
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (cj?.kind === 'picture_desc_prompt') {
      return {
        scene_description: String(cj.scene_description ?? ''),
        instruction: String(cj.instruction ?? ''),
        image_prompt: String(cj.image_prompt ?? ''),
        image_url: String(cj.image_url ?? ''),
      };
    }
  }
  return null;
}

const EMPTY_MEDIA: PictureDescMedia = {
  instruction_audio_b64: '',
  instruction_audio_mime: 'audio/L16;codec=pcm;rate=24000',
  image_url: '',
};

/** KET Speaking Part 3 — Describe the Picture (two-phase loading). */
export function KETDescribePicturePractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETDescribePicturePracticeProps) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PictureDescPlan | null>(null);
  const [media, setMedia] = useState<PictureDescMedia>(EMPTY_MEDIA);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initRef = useRef(false);

  async function loadMedia(p: PictureDescPlan) {
    setMediaLoading(true);
    const m = await generateKETPictureDescMediaAction({
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
          const p: PictureDescPlan = {
            sessionId: initialSessionId ?? '', userId: user?.id ?? '',
            scene_description: r.scene_description, instruction: r.instruction, image_prompt: r.image_prompt,
          };
          setPlan(p);
          if (r.image_url) setMedia({ instruction_audio_b64: '', instruction_audio_mime: 'audio/L16;codec=pcm;rate=24000', image_url: r.image_url });
          else if (initialSessionId) void loadMedia(p);
          setLoading(false);
          return;
        }
      }
      if (initialSessionId) { setLoading(false); return; }

      const result = await generateKETPictureDescPlanAction({ sessionId: initialSessionId });
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
      partLabel="Part 3"
      title="Describe the Picture"
      recordingSeconds={40}
      instructionAudioB64={media.instruction_audio_b64}
      instructionAudioMime={media.instruction_audio_mime}
      instructionText={plan.instruction}
      imageUrl={media.image_url || undefined}
      mediaLoading={mediaLoading}
      imageRequired={true}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETPictureDescAction({
          sessionId: plan.sessionId,
          userId: plan.userId,
          audioBase64: base64,
          audioMime: mime,
          scene_description: plan.scene_description,
        });
        if (!('error' in result)) onSessionFinished?.();
        return result;
      }}
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    />
  );
}
