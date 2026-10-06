'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETPictureDescPlanAction,
  generateKETPictureDescMediaAction,
  evaluateKETPictureDescAction,
  type PictureDescMedia,
} from '@/actions/modes/ket-speaking-part3';
import type { ActivityRenderProps } from '@/lib/routing';
import {
  KET_AUDIO_MIME,
  PICTURE_PLAN_KIND,
  PicturePlanSchema,
  restoreKetSpeaking,
  type PicturePlan,
} from '@/lib/speaking/ket-speaking';

export type KETDescribePicturePracticeProps = ActivityRenderProps;

const EMPTY_MEDIA: PictureDescMedia = {
  instruction_audio_b64: '',
  instruction_audio_mime: KET_AUDIO_MIME,
  image_url: '',
};

function mediaOf(plan: PicturePlan): PictureDescMedia {
  return {
    instruction_audio_b64: plan.instruction_audio_b64 ?? '',
    instruction_audio_mime: plan.instruction_audio_mime ?? KET_AUDIO_MIME,
    image_url: plan.image_url ?? '',
  };
}

export function KETDescribePicturePractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETDescribePicturePracticeProps) {
  const [restored] = useState(() =>
    initialMessages?.length ? restoreKetSpeaking(initialMessages, PICTURE_PLAN_KIND, PicturePlanSchema) : null,
  );
  const [plan, setPlan] = useState<PicturePlan | null>(restored?.plan ?? null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [media, setMedia] = useState<PictureDescMedia>(restored ? mediaOf(restored.plan) : EMPTY_MEDIA);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialSessionId && !restored ? 'Could not reopen this session.' : null);
  const initRef = useRef(false);

  const loadMedia = useCallback(async (p: PicturePlan) => {
    setMediaLoading(true);
    const loaded = await generateKETPictureDescMediaAction({
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
      const result = await generateKETPictureDescPlanAction();
      if ('error' in result) { setErrorMsg(result.error); return; }
      setPlan(result);
      if (result.image_url) setMedia(mediaOf(result));
      else await loadMedia(result);
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
      partLabel="Part 3"
      title="Describe the Picture"
      recordingSeconds={40}
      instructionAudioB64={media.instruction_audio_b64}
      instructionAudioMime={media.instruction_audio_mime}
      instructionText={plan.instruction}
      imageUrl={media.image_url || undefined}
      mediaLoading={mediaLoading}
      imageRequired={true}
      initialFeedback={restored?.feedback ?? null}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETPictureDescAction({
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
