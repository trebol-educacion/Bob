'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETHobbyTalkPlanAction,
  generateKETHobbyTalkMediaAction,
  evaluateKETHobbyTalkAction,
  type HobbyTalkMedia,
} from '@/actions/modes/ket-speaking-part2';
import type { ActivityRenderProps } from '@/lib/routing';
import {
  HOBBY_PLAN_KIND,
  HobbyPlanSchema,
  KET_AUDIO_MIME,
  restoreKetSpeaking,
  type HobbyPlan,
} from '@/lib/speaking/ket-speaking';

export type KETHobbyTalkPracticeProps = ActivityRenderProps;

const EMPTY_MEDIA: HobbyTalkMedia = {
  instruction_audio_b64: '',
  instruction_audio_mime: KET_AUDIO_MIME,
  image_url: '',
};

export function KETHobbyTalkPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETHobbyTalkPracticeProps) {
  const [restored] = useState(() =>
    initialMessages?.length ? restoreKetSpeaking(initialMessages, HOBBY_PLAN_KIND, HobbyPlanSchema) : null,
  );
  const [plan, setPlan] = useState<HobbyPlan | null>(restored?.plan ?? null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [media, setMedia] = useState<HobbyTalkMedia>(
    restored?.plan.image_url ? { ...EMPTY_MEDIA, image_url: restored.plan.image_url } : EMPTY_MEDIA,
  );
  const [mediaLoading, setMediaLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialSessionId && !restored ? 'Could not reopen this session.' : null);
  const initRef = useRef(false);

  const loadMedia = useCallback(async (p: HobbyPlan) => {
    setMediaLoading(true);
    const loaded = await generateKETHobbyTalkMediaAction({
      instruction: p.instruction,
      image_prompt: p.image_prompt,
    }).catch(() => EMPTY_MEDIA);
    setMedia(loaded);
    setMediaLoading(false);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (restored) {
        if (!restored.feedback && !restored.plan.image_url) await loadMedia(restored.plan);
        return;
      }
      if (initialSessionId) return;
      const result = await generateKETHobbyTalkPlanAction();
      if ('error' in result) { setErrorMsg(result.error); return; }
      setPlan(result);
      await loadMedia(result);
    }
    void init();
  }, [restored, initialSessionId, loadMedia]);

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">Back</button>
    </div>
  );

  if (!plan) return <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing speaking exercise…" /></div>;

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
      initialFeedback={restored?.feedback ?? null}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETHobbyTalkAction({
          sessionId,
          plan: { ...plan, image_url: media.image_url },
          audioBase64: base64,
          audioMime: mime,
        });
        if ('error' in result) return result;
        if (!sessionId) {
          setSessionId(result.sessionId);
          onSessionCreated?.(result.sessionId);
        }
        onSessionFinished?.();
        return result.feedback;
      }}
      onBack={onBack}
      onOpenDashboard={onOpenDashboard}
    />
  );
}
