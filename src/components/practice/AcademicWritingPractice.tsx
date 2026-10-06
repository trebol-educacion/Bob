'use client';

import React from 'react';
import { OpenWritingActivity, type OpenWritingConfig } from '@/components/practice/OpenWritingActivity';
import { evaluateAcademicAction, getAcademicTaskAction } from '@/actions/modes/writing-academic';
import { forumPostsOf, type ForumPostData } from '@/lib/toefl/writing-task';
import type { ActivityRenderProps } from '@/lib/routing';

export interface AcademicWritingPracticeProps extends ActivityRenderProps {
  mode: 'toefl_writing_academic_discussion';
}

const CONFIG: Record<AcademicWritingPracticeProps['mode'], OpenWritingConfig> = {
  toefl_writing_academic_discussion: {
    exam_part: 'toefl_writing_academic_discussion',
    bullets: ['State your opinion clearly', 'Support it with a reason or example', 'Respond to at least one classmate'],
    targetWordCount: [100, 200],
  },
};

function ForumThread({ posts }: { posts: ForumPostData[] }) {
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

/** TOEFL Academic Discussion activity: forum thread from the bank plus the shared open-writing flow. */
export function AcademicWritingPractice({ mode, ...activity }: AcademicWritingPracticeProps) {
  return (
    <OpenWritingActivity
      {...activity}
      config={CONFIG[mode]}
      loadTask={getAcademicTaskAction}
      evaluate={evaluateAcademicAction}
      renderHeader={(task) => <ForumThread posts={forumPostsOf(task)} />}
    />
  );
}
