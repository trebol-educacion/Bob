import type { TurnMessage } from '@/lib/session/lifecycle';
import type { ChatMessage } from '@/actions/gemini/types';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { PracticeRubricDetail } from './types';

export const PRACTICE_KIND = {
  open: 'practice_open',
  image: 'practice_image',
  student: 'practice_student',
  reply: 'practice_reply',
  result: 'practice_result',
} as const;

export interface PracticeOpening {
  framing: string;
  message: string;
  imageUrl: string | null;
  imagePrompt: string | null;
}

export interface PracticeStudentTurn {
  text: string;
  signal: PracticeTurnSignal;
}

export interface PracticeResultPayload {
  score: number;
  detail: PracticeRubricDetail;
  feedback: string;
}

export interface StoredPracticeMessage {
  role: 'bob' | 'user';
  msg_type: string;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
}

export interface RestoredPractice {
  framing: string;
  messages: ChatMessage[];
  turnSignals: PracticeTurnSignal[];
  imageUrl: string | null;
  result: PracticeResultPayload | null;
}

/**
 * @param opening - first Bob message plus the optional picture of the scene
 * @returns messages persisted when the session is created
 */
export function buildOpeningMessages(opening: PracticeOpening): TurnMessage[] {
  const messages: TurnMessage[] = [];
  if (opening.imageUrl && /^https?:/.test(opening.imageUrl)) {
    messages.push({
      role: 'bob',
      msgType: 'image_scene',
      contentJson: { kind: PRACTICE_KIND.image, imageUrl: opening.imageUrl, prompt: opening.imagePrompt },
    });
  }
  messages.push({
    role: 'bob',
    msgType: 'text',
    contentText: opening.message,
    contentJson: { kind: PRACTICE_KIND.open, framing: opening.framing },
  });
  return messages;
}

/**
 * @param student - student text with the scaffolding and score signals of the turn
 * @param botText - Bob reply
 * @returns the two messages of one exchange
 */
export function buildExchangeMessages(student: PracticeStudentTurn, botText: string): TurnMessage[] {
  return [
    {
      role: 'user',
      msgType: 'text',
      contentText: student.text,
      contentJson: { kind: PRACTICE_KIND.student, ...student.signal },
    },
    { role: 'bob', msgType: 'text', contentText: botText, contentJson: { kind: PRACTICE_KIND.reply } },
  ];
}

/**
 * @param result - rubric grade computed in code
 * @returns final evaluation payload; score_10 is the canonical grade
 */
export function buildPracticeResultEvaluation(result: PracticeResultPayload): Record<string, unknown> {
  return {
    kind: PRACTICE_KIND.result,
    score_10: result.score,
    rubric_detail: result.detail,
    feedback: result.feedback,
  };
}

function kindOf(message: StoredPracticeMessage): unknown {
  return message.content_json?.kind;
}

function toSignal(json: Record<string, unknown> | null | undefined): PracticeTurnSignal {
  const score = json?.turnScore;
  return {
    hasAudio: json?.hasAudio === true,
    hintUsed: json?.hintUsed === true,
    modelAnswerUsed: json?.modelAnswerUsed === true,
    turnScore: typeof score === 'number' ? score : null,
  };
}

function toResult(json: Record<string, unknown>): PracticeResultPayload | null {
  const detail = json.rubric_detail as Partial<PracticeRubricDetail> | undefined;
  if (typeof json.score_10 !== 'number' || !detail) return null;
  return {
    score: json.score_10,
    detail: {
      participation: detail.participation ?? 0,
      fluency: detail.fluency ?? 0,
      independence: detail.independence ?? 0,
      comprehension: detail.comprehension ?? 0,
    },
    feedback: typeof json.feedback === 'string' ? json.feedback : '',
  };
}

/**
 * @param stored - messages of a reopened practice session in chronological order
 * @returns conversation, scaffolding signals, scene picture and final grade rebuilt from the history
 */
export function restorePractice(stored: StoredPracticeMessage[]): RestoredPractice {
  const restored: RestoredPractice = { framing: '', messages: [], turnSignals: [], imageUrl: null, result: null };
  for (const message of stored) {
    const kind = kindOf(message);
    if (kind === PRACTICE_KIND.image) {
      const url = message.content_json?.imageUrl;
      restored.imageUrl = typeof url === 'string' ? url : null;
    } else if (kind === PRACTICE_KIND.result && message.content_json) {
      restored.result = toResult(message.content_json);
    } else if (kind === PRACTICE_KIND.open || kind === PRACTICE_KIND.reply) {
      restored.messages.push({ role: 'model', text: message.content_text ?? '' });
      if (kind === PRACTICE_KIND.open) restored.framing = String(message.content_json?.framing ?? '');
    } else if (kind === PRACTICE_KIND.student) {
      restored.messages.push({ role: 'user', text: message.content_text ?? '' });
      restored.turnSignals.push(toSignal(message.content_json));
    }
  }
  return restored;
}
