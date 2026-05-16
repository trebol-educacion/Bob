import React from 'react';
import type { ModeKey } from '@/lib/types/practice';
import type { StoredMessage } from '@/actions/messages';
import {
  YLPart1Practice,
  YLPart2Practice,
  YLPart3Practice,
  YLPart4Practice,
  YLPointingPractice,
} from '@/components/practice/yl';
import { B1CollaborativePractice } from '@/components/B1CollaborativePractice';
import { A2Part1Practice } from '@/components/A2Part1Practice';
import { ToeflListenRepeatPractice } from '@/components/ToeflListenRepeatPractice';
import { ToeflInterviewPractice } from '@/components/ToeflInterviewPractice';

export type AppState =
  | 'mode-selection'
  | 'practicing'
  | 'conversation-practicing'
  | 'exam-practicing'
  | 'dashboard';

export interface YLRenderProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
}

export interface ExamRenderProps {
  onBack: () => void;
}

export type RouteKind = 'yl' | 'exam';

export interface RouteEntry {
  appState: AppState;
  kind: RouteKind;
  render: (props: YLRenderProps | ExamRenderProps) => React.JSX.Element;
}

/**
 * Single source of truth for mode-key → component mapping.
 * Indexed by full mode_key (not exam_part) because different frameworks
 * reuse part numbers (e.g. starters_part1 ≠ flyers_part1 ≠ ket_part1).
 */
export const EXAM_PART_COMPONENT_MAP: Record<ModeKey, RouteEntry> = {
  cambridge_starters_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPointingPractice, { exam: 'starters', part: 1, ...(p as YLRenderProps) }),
  },
  cambridge_starters_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart2Practice, { exam: 'starters', part: 2, ...(p as YLRenderProps) }),
  },
  cambridge_starters_part3: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart3Practice, { exam: 'starters', part: 3, ...(p as YLRenderProps) }),
  },
  cambridge_starters_part4: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart4Practice, { exam: 'starters', part: 4, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart1Practice, { exam: 'movers', part: 1, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart2Practice, { exam: 'movers', part: 2, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part3: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart3Practice, { exam: 'movers', part: 3, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part4: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart4Practice, { exam: 'movers', part: 4, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part5: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart4Practice, { exam: 'movers', part: 5, ...(p as YLRenderProps) }),
  },
  cambridge_pet_p3: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(B1CollaborativePractice, { onBack: (p as ExamRenderProps).onBack }),
  },
  cambridge_ket_part1: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(A2Part1Practice, { onBack: (p as ExamRenderProps).onBack }),
  },
  toefl_listen_repeat: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(ToeflListenRepeatPractice, { onBack: (p as ExamRenderProps).onBack }),
  },
  toefl_interview: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(ToeflInterviewPractice, { onBack: (p as ExamRenderProps).onBack }),
  },
};

/** Returns the RouteEntry for the given mode key, or undefined if not in the map. */
export function getRouteForMode(mode: string): RouteEntry | undefined {
  return EXAM_PART_COMPONENT_MAP[mode];
}

/** True when the mode routes to an exam-practicing state (YL or structured exam). */
export function isExamMode(mode: string): boolean {
  return mode in EXAM_PART_COMPONENT_MAP;
}

/** True when the mode is a free-form conversation (no exam structure). */
export function isConversationMode(mode: string): boolean {
  return mode === 'generic_conversation';
}

/** True when the mode belongs to the Cambridge Young Learners family. */
export function isYLMode(mode: string): boolean {
  const entry = EXAM_PART_COMPONENT_MAP[mode];
  return entry?.kind === 'yl';
}

/** True when the mode uses BobPracticeChat in B2 image mode (FCE Part 1). */
export function isFceImageMode(mode: string): boolean {
  return mode === 'cambridge_fce_p1';
}
