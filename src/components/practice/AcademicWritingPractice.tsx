'use client';

import React, { useEffect, useState } from 'react';
import { WritingPractice } from '@/components/practice/WritingPractice';
import { evaluateAcademicAction } from '@/actions/modes/writing-academic';
import { createSessionAction } from '@/actions/sessions';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

export interface ForumPost {
  author: string;
  text: string;
}

/** Routes to the right exam_part config based on mode. */
export interface AcademicWritingPracticeProps {
  mode: 'toefl_writing_academic_discussion' | 'cambridge_fce_writing_part1';
  onBack: () => void;
}

interface AcademicConfig {
  framework: 'cambridge' | 'toefl';
  exam_part: string;
  modeTitle: string;
  instructions: string;
  bullets?: string[];
  targetWordCount: [number, number];
  forumPosts?: ForumPost[];
}

const CONFIG: Record<string, AcademicConfig> = {
  toefl_writing_academic_discussion: {
    framework: 'toefl',
    exam_part: 'toefl_writing_academic_discussion',
    modeTitle: 'TOEFL Writing — Academic Discussion',
    instructions: 'Your professor is asking the class a question about this week\'s topic. Read the discussion and post your contribution.',
    bullets: ['State your opinion clearly', 'Support it with a reason or example', 'Respond to at least one classmate'],
    targetWordCount: [100, 200],
    forumPosts: [
      { author: 'Dr. Smith (Professor)', text: 'Do you think universities should require all students to study abroad for at least one semester? Why or why not?' },
      { author: 'Maria (classmate)', text: 'I think it\'s a great idea because exposure to different cultures builds empathy and communication skills.' },
      { author: 'James (classmate)', text: 'I disagree — not everyone can afford it. Universities should offer virtual exchange programs instead.' },
    ],
  },
  cambridge_fce_writing_part1: {
    framework: 'cambridge',
    exam_part: 'cambridge_fce_writing_part1',
    modeTitle: 'Writing — Part 1 Essay',
    instructions: 'In your English class you have been talking about technology. Now your teacher has asked you to write an essay. Write your essay using all the notes and give reasons for your point of view.',
    bullets: ['Social media and communication', 'Online privacy', 'Your own idea'],
    targetWordCount: [140, 190],
  },
};

/** Academic discussion and essay writing activity for TOEFL Academic Discussion and FCE Essay. */
export function AcademicWritingPractice({ mode, onBack }: AcademicWritingPracticeProps) {
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
    return evaluateAcademicAction({
      ...input,
      framework: config.framework,
      exam_part: config.exam_part,
      targetWordCount: config.targetWordCount,
      bullets: config.bullets,
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full py-2">
      {config.forumPosts && config.forumPosts.length > 0 && (
        <div className="flex flex-col gap-3">
          {config.forumPosts.map((post, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 mb-1">{post.author}</p>
              <p className="text-sm text-gray-700 leading-relaxed">{post.text}</p>
            </div>
          ))}
        </div>
      )}

      <WritingPractice
        promptKey={config.exam_part}
        instructions={config.instructions}
        targetWordCount={config.targetWordCount}
        bullets={config.bullets}
        sessionId={sessionId}
        userId={userId}
        evaluateAction={evaluate}
      />
    </div>
  );
}
