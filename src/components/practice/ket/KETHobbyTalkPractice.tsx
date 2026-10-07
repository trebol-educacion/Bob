'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { KETSpeakingPractice } from './KETSpeakingPractice';
import {
  generateKETHobbyTalkPlanAction,
  evaluateKETHobbyTalkAction,
} from '@/actions/modes/ket-speaking-part2';
import type { ActivityRenderProps } from '@/lib/routing';
import {
  HOBBY_PLAN_KIND,
  HobbyPlanSchema,
  restoreKetSpeaking,
  type HobbyPlan,
} from '@/lib/speaking/ket-speaking';

export type KETHobbyTalkPracticeProps = ActivityRenderProps;

export function KETHobbyTalkPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETHobbyTalkPracticeProps) {
  const [restored] = useState(() =>
    initialMessages?.length ? restoreKetSpeaking(initialMessages, HOBBY_PLAN_KIND, HobbyPlanSchema) : null,
  );
  const [plan, setPlan] = useState<HobbyPlan | null>(restored?.plan ?? null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const errorMsg = initialSessionId && !restored ? 'Could not reopen this session.' : null;
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (restored || initialSessionId) return;
      const result = await generateKETHobbyTalkPlanAction();
      if (!result.ok) { setLoadErrorCode(result.code); return; }
      setPlan(result.data);
    }
    void init();
  }, [restored, initialSessionId]);

  if (loadErrorCode || errorMsg) return <ActivityLoadError code={loadErrorCode} message={errorMsg} onBack={onBack} />;

  if (!plan) return <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing speaking exercise…" /></div>;

  return (
    <KETSpeakingPractice
      partLabel="Part 2"
      title="Talk About a Hobby"
      recordingSeconds={30}
      instructionAudioUrl={plan.instruction_audio_url}
      instructionText={plan.instruction}
      bulletPoints={plan.bullet_points}
      imageUrl={plan.image_url || undefined}
      imageRequired={false}
      initialFeedback={restored?.feedback ?? null}
      onSubmit={async ({ base64, mime }) => {
        const result = await evaluateKETHobbyTalkAction({
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
