/**
 * Cambridge A2 Key challenge — type contracts.
 *
 * Pure type declarations shared by the exam data and the runtime logic.
 */

export type ChallengeSkill = 'listening' | 'reading' | 'writing' | 'speaking';

export type ChallengeFormat =
  | 'listening_picture_mc'
  | 'listening_note_completion'
  | 'listening_conversation_mc'
  | 'listening_monologue_mc'
  | 'listening_matching'
  | 'reading_notices_mc'
  | 'reading_multiple_matching'
  | 'reading_long_text_mc'
  | 'reading_mc_cloze'
  | 'reading_open_cloze'
  | 'writing_guided_email'
  | 'writing_picture_story'
  | 'speaking_interview'
  | 'speaking_collaborative';

/** A picture choice rendered as a labelled placeholder with an optional real image. */
export interface PictureOption {
  key: string;
  caption: string;
  imageUrl?: string;
}

export interface PictureMcQuestion {
  id: string;
  dialogueScript: string;
  question: string;
  options: PictureOption[];
  answer: string;
}

export interface NoteGap {
  id: string;
  label: string;
  answer: string;
}

export interface TextMcQuestion {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface MonologueQuestion {
  id: string;
  speaker: string;
  script: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface MatchingPerson {
  id: string;
  name: string;
  script: string;
  answer: string;
}

export interface MatchingOption {
  key: string;
  text: string;
}

export interface NoticeQuestion {
  id: string;
  noticeText: string;
  noticeImageUrl?: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface MatchingText {
  key: string;
  title: string;
  body: string;
  imageUrl?: string;
}

export interface MatchingStatement {
  id: string;
  text: string;
  answer: string;
}

export interface LongTextQuestion {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface ClozeGap {
  id: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface OpenClozeGap {
  id: string;
  answer: string;
}

export interface WritingChecklistItem {
  id: string;
  text: string;
}

export interface SpeakingQuestion {
  id: string;
  text: string;
}

export interface ListeningPictureMcPart {
  format: 'listening_picture_mc';
  playLimit: number;
  questions: PictureMcQuestion[];
}

export interface ListeningNoteCompletionPart {
  format: 'listening_note_completion';
  playLimit: number;
  script: string;
  noteTitle: string;
  gaps: NoteGap[];
}

export interface ListeningConversationMcPart {
  format: 'listening_conversation_mc';
  playLimit: number;
  script: string;
  questions: TextMcQuestion[];
}

export interface ListeningMonologueMcPart {
  format: 'listening_monologue_mc';
  playLimit: number;
  questions: MonologueQuestion[];
}

export interface ListeningMatchingPart {
  format: 'listening_matching';
  playLimit: number;
  people: MatchingPerson[];
  options: MatchingOption[];
}

export interface ReadingNoticesMcPart {
  format: 'reading_notices_mc';
  questions: NoticeQuestion[];
}

export interface ReadingMultipleMatchingPart {
  format: 'reading_multiple_matching';
  texts: MatchingText[];
  statements: MatchingStatement[];
}

export interface ReadingLongTextMcPart {
  format: 'reading_long_text_mc';
  textTitle: string;
  body: string;
  questions: LongTextQuestion[];
}

export interface ReadingMcClozePart {
  format: 'reading_mc_cloze';
  textTitle: string;
  textBefore: string;
  segments: { gap: ClozeGap; textAfter: string }[];
}

export interface ReadingOpenClozePart {
  format: 'reading_open_cloze';
  textTitle: string;
  textBefore: string;
  segments: { gap: OpenClozeGap; textAfter: string }[];
}

export interface WritingGuidedEmailPart {
  format: 'writing_guided_email';
  prompt: string;
  minWords: number;
  checklist: WritingChecklistItem[];
}

export interface WritingPictureStoryPart {
  format: 'writing_picture_story';
  prompt: string;
  minWords: number;
  pictures: PictureOption[];
}

export interface SpeakingInterviewPart {
  format: 'speaking_interview';
  questions: SpeakingQuestion[];
}

export interface SpeakingCollaborativePart {
  format: 'speaking_collaborative';
  prompt: string;
  visual: PictureOption;
  discussionPoints: string[];
}

export type ChallengePartPayload =
  | ListeningPictureMcPart
  | ListeningNoteCompletionPart
  | ListeningConversationMcPart
  | ListeningMonologueMcPart
  | ListeningMatchingPart
  | ReadingNoticesMcPart
  | ReadingMultipleMatchingPart
  | ReadingLongTextMcPart
  | ReadingMcClozePart
  | ReadingOpenClozePart
  | WritingGuidedEmailPart
  | WritingPictureStoryPart
  | SpeakingInterviewPart
  | SpeakingCollaborativePart;

export type ChallengePart = {
  id: string;
  skill: ChallengeSkill;
  title: string;
  instructions: string;
} & ChallengePartPayload;

export interface ChallengeExam {
  framework: 'cambridge_a2_key';
  title: string;
  subtitle: string;
  parts: ChallengePart[];
}
export type ChallengeImageSlotKind = 'picture' | 'notice' | 'story' | 'collaborative';

export type ImageMap = Record<string, string>;

