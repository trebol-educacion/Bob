export type GapTextMode = 'choice' | 'input' | 'sentence-bank';

export interface GapReview {
  isCorrect: boolean;
  given: string;
  expected: string;
}

export interface GapSentence {
  id: string;
  text: string;
}

export type GapTextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'gap'; number: number };
