import type { FormativeFeedback } from '@/lib/types/practice';

export interface SpeakingQA {
  question: string;
  answer: string;
}

export interface QuestionRoundActions<TPlan> {
  generate: (sessionId: string, userId: string) => Promise<TPlan>;
  processAnswer: (
    audioBase64: string,
    mimeType: string,
    question: string,
    sessionId: string,
    userId: string,
  ) => Promise<{ transcribed: string; reaction: string }>;
  evaluate: (qas: SpeakingQA[], sessionId: string, userId: string) => Promise<FormativeFeedback>;
}

export type Part3Scenario = {
  topic: string;
  situation: string;
  prompt_question: string;
  options: string[];
};

export type Part3ChatMessage = {
  role: 'user' | 'examiner';
  text: string;
};

export interface CollaborativeActions {
  generateScenario: (sessionId?: string) => Promise<Part3Scenario>;
  chatAudio: (
    audioBase64: string,
    mimeType: string,
    history: Part3ChatMessage[],
    scenario: Part3Scenario,
    sessionId?: string,
  ) => Promise<{ transcribed: string; examinerResponse: string }>;
  chatText: (
    text: string,
    history: Part3ChatMessage[],
    scenario: Part3Scenario,
    sessionId?: string,
  ) => Promise<{ examinerResponse: string }>;
  evaluate: (
    history: Part3ChatMessage[],
    scenario: Part3Scenario,
    sessionId?: string,
  ) => Promise<FormativeFeedback>;
  restore: (sessionId: string) => Promise<{ history: Part3ChatMessage[]; feedback: FormativeFeedback | null }>;
}
