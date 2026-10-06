import type { FormativeFeedback } from '@/lib/types/practice';
import type { ActionResult } from '@/lib/result';

export interface SpeakingQA {
  question: string;
  answer: string;
}

export interface QuestionRoundContext<TPlan> {
  sessionId?: string;
  plan: TPlan;
}

export interface QuestionRoundAnswer {
  transcribed: string;
  reaction: string;
  sessionId: string;
}

export interface QuestionRoundEvaluation {
  feedback: FormativeFeedback;
  sessionId?: string;
}

export interface QuestionRoundActions<TPlan> {
  generate: () => Promise<TPlan>;
  processAnswer: (
    audioBase64: string,
    mimeType: string,
    question: string,
    context: QuestionRoundContext<TPlan>,
  ) => Promise<ActionResult<QuestionRoundAnswer>>;
  evaluate: (
    qas: SpeakingQA[],
    context: QuestionRoundContext<TPlan>,
  ) => Promise<ActionResult<QuestionRoundEvaluation>>;
}

export type Part3Scenario = {
  topic: string;
  situation: string;
  prompt_question: string;
  options: string[];
  exam_part?: string;
  bank_group_id?: string;
};

export type Part3ChatMessage = {
  role: 'user' | 'examiner';
  text: string;
};

export interface CollaborativeRestored {
  scenario: Part3Scenario | null;
  history: Part3ChatMessage[];
  feedback: FormativeFeedback | null;
}

export interface CollaborativeActions {
  generateScenario: () => Promise<Part3Scenario>;
  chatAudio: (
    audioBase64: string,
    mimeType: string,
    history: Part3ChatMessage[],
    scenario: Part3Scenario,
    sessionId?: string,
  ) => Promise<ActionResult<{ transcribed: string; examinerResponse: string; sessionId: string }>>;
  chatText: (
    text: string,
    history: Part3ChatMessage[],
    scenario: Part3Scenario,
    sessionId?: string,
  ) => Promise<ActionResult<{ examinerResponse: string; sessionId: string }>>;
  evaluate: (
    history: Part3ChatMessage[],
    scenario: Part3Scenario,
    sessionId?: string,
  ) => Promise<ActionResult<{ feedback: FormativeFeedback; sessionId?: string }>>;
}
