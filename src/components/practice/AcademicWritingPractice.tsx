'use client';

import React from 'react';
import { OpenWritingActivity, type OpenWritingConfig } from '@/components/practice/OpenWritingActivity';
import { evaluateAcademicAction } from '@/actions/modes/writing-academic';
import type { ActivityRenderProps } from '@/lib/routing';

export interface ForumPost {
  author: string;
  text: string;
}

export interface AcademicWritingPracticeProps extends ActivityRenderProps {
  mode: 'toefl_writing_academic_discussion';
}

const CONFIG: Record<AcademicWritingPracticeProps['mode'], OpenWritingConfig> = {
  toefl_writing_academic_discussion: {
    exam_part: 'toefl_writing_academic_discussion',
    instructions: 'Your professor is asking the class a question about this week\'s topic. Read the discussion and post your contribution.',
    bullets: ['State your opinion clearly', 'Support it with a reason or example', 'Respond to at least one classmate'],
    targetWordCount: [100, 200],
  },
};

const FORUM_POSTS: ForumPost[] = [
  { author: 'Dr. Smith (Professor)', text: 'Do you think universities should require all students to study abroad for at least one semester? Why or why not?' },
  { author: 'Maria (classmate)', text: 'I think it\'s a great idea because exposure to different cultures builds empathy and communication skills.' },
  { author: 'James (classmate)', text: 'I disagree, not everyone can afford it. Universities should offer virtual exchange programs instead.' },
];

function ForumThread({ posts }: { posts: ForumPost[] }) {
  return (
    <div className="flex flex-col gap-3">
      {posts.map((post, i) => (
        <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 mb-1">{post.author}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{post.text}</p>
        </div>
      ))}
    </div>
  );
}

/** TOEFL Academic Discussion activity: forum thread plus the shared open-writing flow. */
export function AcademicWritingPractice({ mode, ...activity }: AcademicWritingPracticeProps) {
  return (
    <OpenWritingActivity
      {...activity}
      config={CONFIG[mode]}
      evaluate={evaluateAcademicAction}
      header={<ForumThread posts={FORUM_POSTS} />}
    />
  );
}
