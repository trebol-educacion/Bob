import React from 'react';
import type { ModeKey } from '@/lib/types/practice';
import type { StoredMessage } from '@/actions/messages';
import { FCE_ROUTES } from '@/lib/routing-fce';
import { ylInstanceKey } from '@/lib/route-instance-key';
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
import { PETInterviewPractice } from '@/components/PETInterviewPractice';
import { PETDiscussionPractice } from '@/components/PETDiscussionPractice';
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
  KETOpenClozePractice,
  KETStoryWritingPractice,
  KETHobbyTalkPractice,
  KETDescribePicturePractice,
} from '@/components/practice/ket';
import {
  PETPictureDescriptionPractice,
  PETShortTextsPractice,
  PETEmailWritingPractice,
  PETWritingChallengePractice,
  PETMultipleChoicePractice,
  PETListeningSituationalPractice,
  PETListeningGapFillPractice,
  PETListeningAttitudePractice,
  PETListeningTrueFalseJustifyPractice,
  PETReadingComprehensionPractice,
} from '@/components/practice/pet';

export type AppState =
  | 'home'
  | 'skill-selection'
  | 'placement-required'
  | 'practice-mode-select'
  | 'practice-session'
  | 'assessment-invite'
  | 'assessment-running'
  | 'mode-selection'
  | 'catalog-filtered'
  | 'practicing'
  | 'conversation-practicing'
  | 'exam-practicing'
  | 'dashboard'
  | 'challenge'
  | 'challenge-running';

export interface ActivityRenderProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

export interface RouteEntry {
  appState: AppState;
  render: (props: ActivityRenderProps) => React.JSX.Element;
}

/**
 * Single source of truth for mode-key → component mapping.
 * Indexed by full mode_key (not exam_part) because different frameworks
 * reuse part numbers (e.g. starters_part1 ≠ flyers_part1 ≠ ket_part1).
 */
export const EXAM_PART_COMPONENT_MAP: Record<ModeKey, RouteEntry> = {
  ...FCE_ROUTES,
  cambridge_starters_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLPointingPractice, { key: ylInstanceKey(p), exam: 'starters', part: 1, ...p }),
  },
  cambridge_starters_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLPart2Practice, { key: ylInstanceKey(p), exam: 'starters', part: 2, ...p }),
  },
  cambridge_starters_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLWhatsThisPractice, { key: ylInstanceKey(p), exam: 'starters', part: 3, ...p }),
  },
  cambridge_starters_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLPart4Practice, { key: ylInstanceKey(p), exam: 'starters', part: 4, ...p }),
  },
  cambridge_movers_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLFindDifferencesPractice, { key: ylInstanceKey(p), exam: 'movers', part: 1, ...p }),
  },
  cambridge_movers_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLPart2Practice, { key: ylInstanceKey(p), exam: 'movers', part: 2, ...p }),
  },
  cambridge_movers_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLTellTheStoryPractice, { key: ylInstanceKey(p), exam: 'movers', part: 3, ...p }),
  },
  cambridge_movers_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLPart4Practice, { key: ylInstanceKey(p), exam: 'movers', part: 4, ...p }),
  },
  cambridge_movers_part5: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(YLPart4Practice, { key: ylInstanceKey(p), exam: 'movers', part: 5, ...p }),
  },
  cambridge_pet_p2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETPictureDescriptionPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_p1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETInterviewPractice, { ...p }),
  },
  cambridge_pet_p3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(B1CollaborativePractice, { ...p }),
  },
  cambridge_pet_p4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETDiscussionPractice, { ...p }),
  },
  cambridge_ket_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(A2Part1Practice, { ...p }),
  },
  cambridge_ket_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETHobbyTalkPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETDescribePicturePractice, { key: ylInstanceKey(p), ...p }),
  },
  toefl_listen_repeat: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(ToeflListenRepeatPractice, { ...p }),
  },
  toefl_interview: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(ToeflInterviewPractice, { ...p }),
  },
  toefl_listen_choose_response: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(ListenChooseResponsePractice, { ...p }),
  },
  toefl_writing_build_sentence: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(BuildSentencePractice, { ...p }),
  },
  toefl_writing_email: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(EmailWritingPractice, { mode: 'toefl_writing_email', ...p }),
  },
  cambridge_pet_writing_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETEmailWritingPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_writing_challenge: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETWritingChallengePractice, { key: ylInstanceKey(p), ...p }),
  },
  toefl_writing_academic_discussion: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(AcademicWritingPractice, { mode: 'toefl_writing_academic_discussion', ...p }),
  },
  cambridge_ket_writing_part6: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETShortMessagePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_writing_part7: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETStoryWritingPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_reading_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETShortTextsPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_reading_comprehension: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETReadingComprehensionPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_reading_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETSignsAndNoticesPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_reading_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETMatchQuestionPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_reading_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETLongTextPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_reading_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETVocabGapPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_reading_part5: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETOpenClozePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_listening_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETListenAndChoosePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_listening_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETListenAndCompletePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_listening_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETListenAndDecidePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_listening_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETShortTalksPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_ket_listening_part5: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(KETTrueFalseDoesntSayPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_listening_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETListeningSituationalPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_listening_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETMultipleChoicePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_listening_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETListeningGapFillPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_listening_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETListeningAttitudePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_pet_listening_part5: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(PETListeningTrueFalseJustifyPractice, { key: ylInstanceKey(p), ...p }),
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

