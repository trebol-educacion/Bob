import type React from 'react';

export type ChatPhase =
  | 'topic-input'
  | 'image-config'
  | 'generating'
  | 'phrase-ready'
  | 'recording'
  | 'evaluating'
  | 'result'
  | 'finished';

export type ChatMsg = {
  id: string;
  role: 'bob' | 'user';
  content: React.ReactNode;
};
