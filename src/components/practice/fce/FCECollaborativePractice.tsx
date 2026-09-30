'use client';

import React from 'react';
import {
  chatFCECollaborativeAction,
  chatFCECollaborativeTextAction,
  evaluateFCECollaborativeAction,
  generateFCECollaborativeScenarioAction,
  getFCECollaborativeMessagesAction,
} from '@/actions/modes/fce-p3';
import { FCE_COLLABORATIVE_MODE, FCE_COLLABORATIVE_PRESETS } from '@/lib/speaking/fce-content';
import {
  CollaborativePractice,
  type CollaborativePracticeConfig,
} from '@/components/practice/speaking/collaborative';

export interface FCECollaborativePracticeProps {
  onBack: () => void;
  sessionId?: string;
}

const FCE_COLLABORATIVE_UI_CONFIG: CollaborativePracticeConfig = {
  mode: FCE_COLLABORATIVE_MODE,
  sessionTitlePrefix: 'B2 Collaborative',
  presets: FCE_COLLABORATIVE_PRESETS,
  maxTurns: 6,
  finishEarlyAfterTurns: 5,
  translationScope: 'fce.collaborative',
  actions: {
    generateScenario: generateFCECollaborativeScenarioAction,
    chatAudio: chatFCECollaborativeAction,
    chatText: chatFCECollaborativeTextAction,
    evaluate: evaluateFCECollaborativeAction,
    restore: getFCECollaborativeMessagesAction,
  },
};

export function FCECollaborativePractice({ onBack, sessionId }: FCECollaborativePracticeProps) {
  return <CollaborativePractice config={FCE_COLLABORATIVE_UI_CONFIG} onBack={onBack} sessionId={sessionId} />;
}
