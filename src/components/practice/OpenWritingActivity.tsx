'use client';

import React, { useState } from 'react';
import { WritingPractice } from '@/components/practice/WritingPractice';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreOpenWriting } from '@/lib/writing/open-writing-restore';
import type { ActivityRenderProps } from '@/lib/routing';
import type { OpenWritingOutcome } from '@/lib/writing/open-writing';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

export interface OpenWritingConfig {
  exam_part: string;
  instructions: string;
  bullets?: string[];
  targetWordCount: [number, number];
}

export interface OpenWritingActivityProps extends ActivityRenderProps {
  config: OpenWritingConfig;
  evaluate: (input: {
    text: string;
    sessionId?: string;
    exam_part: string;
    instructions: string;
    targetWordCount: [number, number];
  }) => Promise<OpenWritingOutcome | { error: string }>;
  header?: React.ReactNode;
}

/** Open writing activity: the session is created by the first evaluated submission and reopens with text and feedback. */
export function OpenWritingActivity({
  config,
  evaluate,
  header,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: OpenWritingActivityProps) {
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore: restoreOpenWriting }),
  );
  const [sessionId, setSessionId] = useState(initialSessionId);

  if (boot.kind === 'restore-failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-red-500 font-semibold">Could not restore this session.</p>
        <button onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
          Back
        </button>
      </div>
    );
  }

  async function evaluateSubmission(input: { text: string }): Promise<WritingFormativeFeedback | { error: string }> {
    const outcome = await evaluate({
      text: input.text,
      sessionId,
      exam_part: config.exam_part,
      instructions: config.instructions,
      targetWordCount: config.targetWordCount,
    });
    if ('error' in outcome) return outcome;
    if (!sessionId) onSessionCreated?.(outcome.sessionId);
    setSessionId(outcome.sessionId);
    onSessionFinished?.();
    return outcome.feedback;
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full py-2">
      {header}
      <WritingPractice
        promptKey={config.exam_part}
        instructions={config.instructions}
        targetWordCount={config.targetWordCount}
        bullets={config.bullets}
        initialText={boot.kind === 'restore' ? boot.data.text : undefined}
        initialFeedback={boot.kind === 'restore' ? boot.data.feedback : undefined}
        evaluateAction={evaluateSubmission}
      />
    </div>
  );
}
