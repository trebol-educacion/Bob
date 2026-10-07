'use client';

import React from 'react';
import { OpenWritingActivity, type OpenWritingConfig } from '@/components/practice/OpenWritingActivity';
import { evaluateEmailAction, getEmailTaskAction } from '@/actions/modes/writing-email';
import type { ActivityRenderProps } from '@/lib/routing';

export interface EmailWritingPracticeProps extends ActivityRenderProps {
  mode: 'toefl_writing_email';
}

const CONFIG: Record<EmailWritingPracticeProps['mode'], OpenWritingConfig> = {
  toefl_writing_email: {
    exam_part: 'toefl_writing_email',
    bullets: ['Introduce yourself', 'State your request clearly', 'Close politely'],
    targetWordCount: [80, 100],
  },
};

function EmailBrief({ task }: { task: Record<string, unknown> | null }) {
  if (!task) return null;
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed flex flex-col gap-1">
      <p>{String(task.scenario ?? '')}</p>
      <p><span className="font-semibold">To:</span> {String(task.recipient ?? '')}</p>
      <p><span className="font-semibold">Purpose:</span> {String(task.purpose ?? '')}</p>
    </div>
  );
}

/** TOEFL email writing activity; delegates session handling to OpenWritingActivity. */
export function EmailWritingPractice({ mode, ...activity }: EmailWritingPracticeProps) {
  return (
    <OpenWritingActivity
      {...activity}
      config={CONFIG[mode]}
      loadTask={getEmailTaskAction}
      evaluate={evaluateEmailAction}
      renderHeader={(task) => <EmailBrief task={task} />}
    />
  );
}
