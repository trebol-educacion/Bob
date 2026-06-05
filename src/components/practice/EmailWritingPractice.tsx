'use client';

import React, { useEffect, useState } from 'react';
import { WritingPractice } from '@/components/practice/WritingPractice';
import { evaluateEmailAction } from '@/actions/modes/writing-email';
import { createSessionAction } from '@/actions/sessions';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

interface EmailWritingPracticeInternalProps {
  framework: 'cambridge' | 'toefl';
  exam_part: string;
  modeTitle: string;
  instructions: string;
  bullets?: string[];
  targetWordCount: [number, number];
  onBack: () => void;
}

/** Routes to the right exam_part config based on mode. */
export interface EmailWritingPracticeProps {
  mode: 'cambridge_pet_writing_part1' | 'toefl_writing_email';
  onBack: () => void;
}

const CONFIG: Record<
  string,
  Pick<EmailWritingPracticeInternalProps, 'framework' | 'exam_part' | 'modeTitle' | 'instructions' | 'bullets' | 'targetWordCount'>
> = {
  cambridge_pet_writing_part1: {
    framework: 'cambridge',
    exam_part: 'cambridge_pet_writing_part1',
    modeTitle: 'Writing — Part 1 Email',
    instructions: 'You have received an email from your English-speaking friend. Read the email and write a reply. Write about 100 words.',
    bullets: ['Thank your friend', 'Answer their questions', 'Invite them to visit'],
    targetWordCount: [80, 100],
  },
  toefl_writing_email: {
    framework: 'toefl',
    exam_part: 'toefl_writing_email',
    modeTitle: 'TOEFL Writing — Email Task',
    instructions: 'Read the situation below and write an email response. Write 80–100 words.',
    bullets: ['Introduce yourself', 'State your request clearly', 'Close politely'],
    targetWordCount: [80, 100],
  },
};

/** Email writing activity for PET (B1 Cambridge) and TOEFL; creates session and delegates to WritingPractice. */
export function EmailWritingPractice({ mode, onBack }: EmailWritingPracticeProps) {
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const config = CONFIG[mode];

  useEffect(() => {
    async function init() {
      const sessionResult = await createSessionAction({
        mode,
        title: config.modeTitle,
      });
      if (!sessionResult.data) {
        setErrorMsg(sessionResult.error ?? 'Failed to create session');
        return;
      }
      setSessionId(sessionResult.data.id);
      setUserId(sessionResult.data.user_id);
      setReady(true);
    }
    void init();
  }, [mode, config.modeTitle]);

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
          Back
        </button>
      </div>
    );
  }

  if (!ready) {
    return <BobMascotLoader message="Loading writing activity…" />;
  }

  async function evaluate(input: { text: string; sessionId: string; userId: string }): Promise<WritingFormativeFeedback | { error: string }> {
    return evaluateEmailAction({
      ...input,
      framework: config.framework,
      exam_part: config.exam_part,
      targetWordCount: config.targetWordCount,
      bullets: config.bullets,
    });
  }

  return (
    <WritingPractice
      promptKey={config.exam_part}
      instructions={config.instructions}
      targetWordCount={config.targetWordCount}
      bullets={config.bullets}
      sessionId={sessionId}
      userId={userId}
      evaluateAction={evaluate}
    />
  );
}
