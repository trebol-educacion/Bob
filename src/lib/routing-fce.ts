import React from 'react';
import type { ModeKey } from '@/lib/types/practice';
import type { RouteEntry } from '@/lib/routing';
import { ylInstanceKey } from '@/lib/route-instance-key';
import {
  FCEMultipleChoiceClozePractice,
  FCEPictureDescriptionPractice,
  FCEEssayWritingPractice,
  FCEWritingPart2Practice,
  FCEShortExtractsPractice,
  FCEInterviewPractice,
  FCECollaborativePractice,
  FCEDiscussionPractice,
  FCEListeningGapFillPractice,
  FCEListeningInterviewPractice,
  FCEReadingMatchingPractice,
  FCEListeningMatchingPractice,
  FCEGroupedReadingPractice,
} from '@/components/practice/fce';

export const FCE_ROUTES: Record<ModeKey, RouteEntry> = {
  cambridge_fce_writing_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEEssayWritingPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_writing_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEWritingPart2Practice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_reading_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEMultipleChoiceClozePractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_reading_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEGroupedReadingPractice, { key: ylInstanceKey(p), part: 'fce_reading_part2', ...p }),
  },
  cambridge_fce_reading_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEGroupedReadingPractice, { key: ylInstanceKey(p), part: 'fce_reading_part3', ...p }),
  },
  cambridge_fce_reading_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEGroupedReadingPractice, { key: ylInstanceKey(p), part: 'fce_reading_part4', ...p }),
  },
  cambridge_fce_reading_part5: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEGroupedReadingPractice, { key: ylInstanceKey(p), part: 'fce_reading_part5', ...p }),
  },
  cambridge_fce_reading_part6: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEGroupedReadingPractice, { key: ylInstanceKey(p), part: 'fce_reading_part6', ...p }),
  },
  cambridge_fce_p1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEInterviewPractice, { ...p }),
  },
  cambridge_fce_p3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCECollaborativePractice, { ...p }),
  },
  cambridge_fce_p4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEDiscussionPractice, { ...p }),
  },
  cambridge_fce_p2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEPictureDescriptionPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_reading_part7: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEReadingMatchingPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_listening_part3: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEListeningMatchingPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_listening_part2: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEListeningGapFillPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_listening_part4: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEListeningInterviewPractice, { key: ylInstanceKey(p), ...p }),
  },
  cambridge_fce_listening_part1: {
    appState: 'exam-practicing',
    render: (p) => React.createElement(FCEShortExtractsPractice, { key: ylInstanceKey(p), ...p }),
  },
};
