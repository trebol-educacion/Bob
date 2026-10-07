'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETPictureDescPlanAction,
  evaluateKETPictureDescAction,
} from '@/actions/modes/ket-speaking-part3';
import type { ActivityRenderProps } from '@/lib/routing';
import {
  PICTURE_PLAN_KIND,
  PicturePlanSchema,
  restoreKetSpeaking,
  type PicturePlan,
} from '@/lib/speaking/ket-speaking';

export type KETDescribePicturePracticeProps = ActivityRenderProps;

export function KETDescribePicturePractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETDescribePicturePracticeProps) {
  const [restored] = useState(() =>
    initialMessages?.length ? restoreKetSpeaking(initialMessages, PICTURE_PLAN_KIND, PicturePlanSchema) : null,
  );
  const [plan, setPlan] = useState<PicturePlan | null>(restored?.plan ?? null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const errorMsg = initialSessionId && !restored ? 'Could not reopen this session.' : null;
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (restored || initialSessionId) return;
      const result = await generateKETPictureDescPlanAction();
      if (!result.ok) { setLoadErrorCode(result.code); return; }
      setPlan(result.data);
    }
    void init();
  }, [restored, initialSessionId]);

  if (loadErrorCode || errorMsg) return <ActivityLoadError code={loadErrorCode} message={errorMsg} onBack={onBack} />;

  if (!plan) return <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing speaking exercise…" /></div>;

  return (
    <KETSpeakingPractice
      partLabel="Part 3"
      title="Describe the Picture"
      recordingSeconds={40}
      instructionAudioUrl={plan.instruction_audio_url}
      instructionText={plan.instruction}
      imageUrl={plan.image_url || undefined}
      imageRequired={true}
      initialFeedback={restored?.feedback ?? null}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETPictureDescAction({
          sessionId,
          plan,
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
