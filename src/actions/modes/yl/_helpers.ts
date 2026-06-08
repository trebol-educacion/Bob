import { type EvalResponse } from '@/lib/types/practice';
import { type YLExam, type YLPlan } from '@/lib/types/yl';

/** Map a ModeKey to exam + part number. */
export function parseYLMode(mode: string): { exam: YLExam; part: number } {
  const match = mode.match(/^cambridge_(starters|movers)_part(\d+)$/);
  if (!match) {
    console.error(JSON.stringify({ event: 'parseYLMode', error: `Unrecognised YL mode key: ${mode}` }));
    return { exam: 'starters', part: 1 };
  }
  return { exam: match[1] as YLExam, part: Number(match[2]) };
}

/** Build the generation prompt key for a given exam+part. */
export function generationKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_generation`;
}

/** Build the evaluation prompt key. */
export function evaluationKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_evaluation`;
}

/** Build the examiner reaction prompt key. */
export function reactionKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_examiner_reaction`;
}

/** Build the image_gen prompt key. */
export function imageGenKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_image_gen`;
}

export const YLPlanFallback: YLPlan = {
  cues: ['Point to something red.', 'Point to something big.', 'Point to a cat.', 'Point to a house.'],
  image_prompts: ['A colourful room with many objects including red and big items, a cat, and a house.'],
};

export const EvalFallback: EvalResponse = {
  score: 5,
  score_max: 15,
  cefr_band: 'a1',
  feedback: 'Nice try! Keep practising.',
};
