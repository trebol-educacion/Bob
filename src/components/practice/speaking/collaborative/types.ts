import type { StoredMessage } from '@/actions/messages';
import type { CollaborativeActions, Part3Scenario } from '@/lib/speaking/types';

export interface CollaborativePracticeConfig {
  presets: Part3Scenario[];
  maxTurns: number;
  finishEarlyAfterTurns: number;
  translationScope?: string;
  actions: CollaborativeActions;
}

export interface CollaborativeSessionParams {
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

export interface CollaborativePracticeProps extends CollaborativeSessionParams {
  config: CollaborativePracticeConfig;
  onBack: () => void;
}

export type CollaborativePhase = 'intro' | 'conversation' | 'evaluating' | 'result';
