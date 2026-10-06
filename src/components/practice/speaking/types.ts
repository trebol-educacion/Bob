import type { ReactNode } from 'react';
import type { StoredMessage } from '@/actions/messages';
import type { QuestionRoundSchema } from '@/lib/speaking/question-round-schema';
import type { QuestionRoundActions } from '@/lib/speaking/types';

export type QuestionRoundStep = 'answer' | 'recording' | 'review' | 'processing' | 'transition';

export interface QuestionRoundConfig<TPlan> {
  planSchema: QuestionRoundSchema<TPlan>;
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

export interface QuestionRoundSessionParams {
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

export interface QuestionRoundPracticeProps<TPlan> extends QuestionRoundSessionParams {
  config: QuestionRoundConfig<TPlan>;
  onBack: () => void;
}
