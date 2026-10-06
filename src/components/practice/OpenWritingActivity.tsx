'use client';

import React, { useEffect, useState } from 'react';
import { WritingPractice } from '@/components/practice/WritingPractice';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreOpenWriting } from '@/lib/writing/open-writing-restore';
import type { ActivityRenderProps } from '@/lib/routing';
import type { ActionResult } from '@/lib/result';
import type { WritingTask } from '@/lib/toefl/writing-task';
import type { OpenWritingOutcome } from '@/lib/writing/open-writing';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

export interface OpenWritingConfig {
  exam_part: string;
  bullets?: string[];
  targetWordCount: [number, number];
}

export interface OpenWritingActivityProps extends ActivityRenderProps {
  config: OpenWritingConfig;
  loadTask: () => Promise<ActionResult<WritingTask>>;
  evaluate: (input: {
    text: string;
    sessionId?: string;
    exam_part: string;
    instructions: string;
    targetWordCount: [number, number];
    task?: Record<string, unknown>;
    bankGroupId?: string;
  }) => Promise<OpenWritingOutcome | { error: string }>;
  renderHeader?: (task: Record<string, unknown> | null) => React.ReactNode;
}

/** Open writing activity: the task comes from the bank, the session is created by the first evaluated submission and reopens with task, text and feedback. */
export function OpenWritingActivity({
  config,
  loadTask,
  evaluate,
  renderHeader,
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: OpenWritingActivityProps) {
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore: restoreOpenWriting }),
  );
  const restored = boot.kind === 'restore' ? boot.data : null;
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [task, setTask] = useState<WritingTask | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(boot.kind === 'restore-failed' ? 'restore_failed' : null);

  useEffect(() => {
    if (boot.kind !== 'generate') return;
    let cancelled = false;
    void loadTask().then((result) => {
      if (cancelled) return;
      if (result.ok) setTask(result.data);
      else setLoadErrorCode(result.code);
    });
    return () => {
      cancelled = true;
    };
  }, [boot.kind, loadTask]);

  if (loadErrorCode) return <ActivityLoadError code={loadErrorCode} onBack={onBack} />;
  if (!restored && !task) return <BobMascotLoader message="" />;

  const instructions = restored?.instructions ?? task?.instructions ?? '';
  const taskJson = restored?.task ?? task?.task ?? null;

  async function evaluateSubmission(input: { text: string }): Promise<WritingFormativeFeedback | { error: string }> {
    const outcome = await evaluate({
      text: input.text,
      sessionId,
      exam_part: config.exam_part,
      instructions,
      targetWordCount: config.targetWordCount,
      task: taskJson ?? undefined,
      bankGroupId: task?.bankGroupId,
    });
    if ('error' in outcome) return outcome;
    if (!sessionId) onSessionCreated?.(outcome.sessionId);
    setSessionId(outcome.sessionId);
    onSessionFinished?.();
    return outcome.feedback;
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full py-2">
      {renderHeader?.(taskJson)}
      <WritingPractice
        promptKey={config.exam_part}
        instructions={instructions}
        targetWordCount={config.targetWordCount}
        bullets={config.bullets}
        initialText={restored?.text}
        initialFeedback={restored?.feedback}
        evaluateAction={evaluateSubmission}
      />
    </div>
  );
}
