import type { ReactNode } from 'react';
import type { QuestionRoundActions } from '@/lib/speaking/types';

export type QuestionRoundStep = 'answer' | 'recording' | 'review' | 'processing' | 'transition';

export interface QuestionRoundConfig<TPlan> {
  mode: string;
  sessionTitle: string;
  headerTitle: string;
  headerSubtitle: string;
  levelBadge: string;
  loadingMessage: string;
  completeTitle: string;
  completeSubtitle: string;
  toQuestions: (plan: TPlan) => string[];
  renderPlanIntro?: (plan: TPlan) => ReactNode;
  actions: QuestionRoundActions<TPlan>;
}

export interface QuestionRoundPracticeProps<TPlan> {
  config: QuestionRoundConfig<TPlan>;
  onBack: () => void;
}
