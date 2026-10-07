'use client';

import React from 'react';
import {
  generatePart3ScenarioAction,
  chatPart3Action,
  chatPart3TextAction,
  evaluatePart3Action,
} from '@/actions/modes/part3';
import { unwrapContent } from '@/lib/content/unwrap-content';
import type { ActivityRenderProps } from '@/lib/routing';
import type { Part3Scenario } from '@/lib/speaking/types';
import {
  CollaborativePractice,
  type CollaborativePracticeConfig,
} from '@/components/practice/speaking/collaborative';

type B1CollaborativePracticeProps = Pick<
  ActivityRenderProps,
  'onBack' | 'sessionId' | 'initialMessages' | 'onSessionCreated' | 'onSessionFinished'
>;

const PRESET_SCENARIOS: Part3Scenario[] = [
  {
    topic: 'Planning a Class Trip',
    situation:
      'Your class is planning a one-day trip. You need to decide which activities to include.',
    prompt_question: 'Which activities would be most fun and educational for the class?',
    options: [
      'Visit a museum',
      'Go to a science centre',
      'Explore a nature park',
      'Tour a factory',
      'Watch a live performance',
    ],
  },
  {
    topic: 'Improving the School',
    situation:
      'The school has money to improve one area. Students have been asked for their opinions.',
    prompt_question: 'Which improvement would benefit students most?',
    options: [
      'New sports facilities',
      'Better computer lab',
      'School garden',
      'Improved library',
      'Music practice rooms',
    ],
  },
  {
    topic: 'Weekend Activities',
    situation: 'A group of friends wants to plan a perfect Saturday together.',
    prompt_question: 'Which activity would make the best Saturday for a group of teenagers?',
    options: [
      'Have a picnic in the park',
      'Watch a film at the cinema',
      'Play sports together',
      'Visit a local market',
      'Cook a meal at home',
    ],
  },
];

const B1_COLLABORATIVE_CONFIG: CollaborativePracticeConfig = {
  presets: PRESET_SCENARIOS,
  maxTurns: 8,
  finishEarlyAfterTurns: 4,
  actions: {
    generateScenario: async () => unwrapContent(await generatePart3ScenarioAction()),
    chatAudio: chatPart3Action,
    chatText: chatPart3TextAction,
    evaluate: evaluatePart3Action,
  },
};

export function B1CollaborativePractice(props: B1CollaborativePracticeProps) {
  return <CollaborativePractice config={B1_COLLABORATIVE_CONFIG} {...props} />;
}
