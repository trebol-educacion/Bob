'use client';

import React from 'react';
import {
  chatFCECollaborativeAction,
  chatFCECollaborativeTextAction,
  evaluateFCECollaborativeAction,
  generateFCECollaborativeScenarioAction,
} from '@/actions/modes/fce-p3';
import { FCE_COLLABORATIVE_PRESETS } from '@/lib/speaking/fce-content';
import type { ActivityRenderProps } from '@/lib/routing';
import {
  CollaborativePractice,
  type CollaborativePracticeConfig,
} from '@/components/practice/speaking/collaborative';

export type FCECollaborativePracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

const FCE_COLLABORATIVE_UI_CONFIG: CollaborativePracticeConfig = {
  presets: FCE_COLLABORATIVE_PRESETS,
  maxTurns: 6,
  finishEarlyAfterTurns: 5,
  translationScope: 'fce.collaborative',
  actions: {
    generateScenario: generateFCECollaborativeScenarioAction,
    chatAudio: chatFCECollaborativeAction,
    chatText: chatFCECollaborativeTextAction,
    evaluate: evaluateFCECollaborativeAction,
  },
};

export function FCECollaborativePractice(props: FCECollaborativePracticeProps) {
  return <CollaborativePractice config={FCE_COLLABORATIVE_UI_CONFIG} {...props} />;
}
