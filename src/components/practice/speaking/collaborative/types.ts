import type { CollaborativeActions, Part3Scenario } from '@/lib/speaking/types';

export interface CollaborativePracticeConfig {
  mode: string;
  sessionTitlePrefix: string;
  presets: Part3Scenario[];
  maxTurns: number;
  finishEarlyAfterTurns: number;
  translationScope?: string;
  actions: CollaborativeActions;
}

export interface CollaborativePracticeProps {
  config: CollaborativePracticeConfig;
  onBack: () => void;
  sessionId?: string;
}

export type CollaborativePhase = 'intro' | 'conversation' | 'evaluating' | 'result';
