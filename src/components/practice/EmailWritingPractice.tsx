'use client';

import React from 'react';
import { OpenWritingActivity, type OpenWritingConfig } from '@/components/practice/OpenWritingActivity';
import { evaluateEmailAction } from '@/actions/modes/writing-email';
import type { ActivityRenderProps } from '@/lib/routing';

export interface EmailWritingPracticeProps extends ActivityRenderProps {
  mode: 'toefl_writing_email';
}

const CONFIG: Record<EmailWritingPracticeProps['mode'], OpenWritingConfig> = {
  toefl_writing_email: {
    exam_part: 'toefl_writing_email',
    instructions: 'Read the situation below and write an email response. Write 80-100 words.',
    bullets: ['Introduce yourself', 'State your request clearly', 'Close politely'],
    targetWordCount: [80, 100],
  },
};

/** TOEFL email writing activity; delegates session handling to OpenWritingActivity. */
export function EmailWritingPractice({ mode, ...activity }: EmailWritingPracticeProps) {
  return <OpenWritingActivity {...activity} config={CONFIG[mode]} evaluate={evaluateEmailAction} />;
}
