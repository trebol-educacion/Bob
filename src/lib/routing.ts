import React from 'react';
import type { ModeKey } from '@/lib/types/practice';
import type { StoredMessage } from '@/actions/messages';
import {
  YLPart2Practice,
  YLPart4Practice,
  YLPointingPractice,
  YLWhatsThisPractice,
  YLFindDifferencesPractice,
  YLTellTheStoryPractice,
} from '@/components/practice/yl';
import { B1CollaborativePractice } from '@/components/B1CollaborativePractice';
import { A2Part1Practice } from '@/components/A2Part1Practice';
import { ToeflListenRepeatPractice } from '@/components/ToeflListenRepeatPractice';
import { ToeflInterviewPractice } from '@/components/ToeflInterviewPractice';
import { ListenChooseResponsePractice } from '@/components/practice/ListenChooseResponsePractice';
import { BuildSentencePractice } from '@/components/practice/BuildSentencePractice';
import { EmailWritingPractice } from '@/components/practice/EmailWritingPractice';
import { AcademicWritingPractice } from '@/components/practice/AcademicWritingPractice';
import {
  KETShortMessagePractice,
  KETSignsAndNoticesPractice,
  KETListenAndChoosePractice,
  KETListenAndCompletePractice,
  KETListenAndDecidePractice,
  KETShortTalksPractice,
  KETTrueFalseDoesntSayPractice,
  KETMatchQuestionPractice,
  KETLongTextPractice,
  KETVocabGapPractice,
  KETReadingTFDSPractice,
  KETStoryWritingPractice,
} from '@/components/practice/ket';
import {
  PETPictureDescriptionPractice,
  PETShortTextsPractice,
  PETEmailWritingPractice,
  PETMultipleChoicePractice,
} from '@/components/practice/pet';
import {
  FCEMultipleChoiceClozePractice,
  FCEPictureDescriptionPractice,
  FCEEssayWritingPractice,
  FCEShortExtractsPractice,
} from '@/components/practice/fce';

export type AppState =
  | 'skill-selection'
  | 'assessment-invite'
  | 'assessment-running'
  | 'assessment-result'
  | 'mode-selection'
  | 'catalog-filtered'
  | 'practicing'
  | 'conversation-practicing'
  | 'exam-practicing'
  | 'dashboard';

export interface YLRenderProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
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
 * Key used to force remount of a YL component when switching between two
 * persisted sessions (history-history). Returns 'new' while the session has
 * no persisted messages — including the moment right after creation, before
 * the new session has any messages stored — so we don't remount and lose
 * the freshly-generated plan/images.
 */
function ylInstanceKey(p: YLRenderProps): string {
  return p.initialMessages && p.initialMessages.length > 0
    ? p.sessionId ?? 'new'
    : 'new';
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
    render: (p) => React.createElement(YLPointingPractice, { key: ylInstanceKey(p as YLRenderProps), exam: 'starters', part: 1, ...(p as YLRenderProps) }),
  },
  cambridge_starters_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart2Practice, { key: ylInstanceKey(p as YLRenderProps), exam: 'starters', part: 2, ...(p as YLRenderProps) }),
  },
  cambridge_starters_part3: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLWhatsThisPractice, { key: ylInstanceKey(p as YLRenderProps), exam: 'starters', part: 3, ...(p as YLRenderProps) }),
  },
  cambridge_starters_part4: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart4Practice, { key: ylInstanceKey(p as YLRenderProps), exam: 'starters', part: 4, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLFindDifferencesPractice, { key: ylInstanceKey(p as YLRenderProps), exam: 'movers', part: 1, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart2Practice, { key: ylInstanceKey(p as YLRenderProps), exam: 'movers', part: 2, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part3: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLTellTheStoryPractice, { key: ylInstanceKey(p as YLRenderProps), exam: 'movers', part: 3, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part4: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart4Practice, { key: ylInstanceKey(p as YLRenderProps), exam: 'movers', part: 4, ...(p as YLRenderProps) }),
  },
  cambridge_movers_part5: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(YLPart4Practice, { key: ylInstanceKey(p as YLRenderProps), exam: 'movers', part: 5, ...(p as YLRenderProps) }),
  },
  cambridge_pet_p2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(PETPictureDescriptionPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
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
  toefl_listen_choose_response: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(ListenChooseResponsePractice, { onBack: (p as ExamRenderProps).onBack }),
  },
  toefl_writing_build_sentence: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(BuildSentencePractice, { onBack: (p as ExamRenderProps).onBack }),
  },
  toefl_writing_email: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(EmailWritingPractice, { mode: 'toefl_writing_email', onBack: (p as ExamRenderProps).onBack }),
  },
  cambridge_pet_writing_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(PETEmailWritingPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  toefl_writing_academic_discussion: {
    appState: 'exam-practicing',
    kind: 'exam',
    render: (p) => React.createElement(AcademicWritingPractice, { mode: 'toefl_writing_academic_discussion', onBack: (p as ExamRenderProps).onBack }),
  },
  cambridge_fce_writing_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(FCEEssayWritingPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_writing_part6: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETShortMessagePractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_writing_part7: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETStoryWritingPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_pet_reading_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(PETShortTextsPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_reading_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETSignsAndNoticesPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_reading_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETMatchQuestionPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_reading_part3: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETLongTextPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_reading_part4: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETVocabGapPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_reading_part5: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETReadingTFDSPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_listening_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETListenAndChoosePractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_listening_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETListenAndCompletePractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_listening_part3: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETListenAndDecidePractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_listening_part4: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETShortTalksPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_ket_listening_part5: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(KETTrueFalseDoesntSayPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_pet_listening_part2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(PETMultipleChoicePractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_fce_reading_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(FCEMultipleChoiceClozePractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_fce_p2: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(FCEPictureDescriptionPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
  },
  cambridge_fce_listening_part1: {
    appState: 'exam-practicing',
    kind: 'yl',
    render: (p) => React.createElement(FCEShortExtractsPractice, { key: ylInstanceKey(p as YLRenderProps), ...(p as YLRenderProps) }),
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
