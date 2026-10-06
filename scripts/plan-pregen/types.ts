import type { z } from 'zod';
import type { GoogleGenAI } from '@google/genai';
import type { Db } from '../b2-pregen/env';
import type { JudgeKind } from '../b2-pregen/semantic-judge';

export type PlanExam = 'ket' | 'pet' | 'toefl' | 'yle_starters' | 'yle_movers';
export type PlanSkill = 'listening' | 'reading' | 'writing' | 'speaking';

export interface SlotContext {
  topic: string;
  slot: number;
  variant: string;
  existing: string[];
}

export interface JudgeRequest {
  kind: JudgeKind;
  input: unknown;
}

export interface ProduceEnv {
  ai: GoogleGenAI;
  db: Db;
  variant: string;
  slot: number;
  examPart: string;
}

export interface PlanPart<P = unknown> {
  exam: PlanExam;
  cefr: string;
  skill: PlanSkill;
  examPart: string;
  promptKey: string;
  short: string;
  schema: z.ZodType<P>;
  topics?: string[];
  message?: (prompt: string, ctx: SlotContext) => string;
  normalize?: (plan: P) => P;
  rules?: (plan: P) => string[];
  judge?: (plan: P) => JudgeRequest | null;
  produce?: (plan: P, env: ProduceEnv) => Promise<P>;
  labelOf?: (plan: P) => string;
}

/**
 * @template P plan contract of the part
 * @param part typed definition
 * @returns the same definition erased to the registry type
 */
export function definePart<P>(part: PlanPart<P>): PlanPart {
  return part as unknown as PlanPart;
}
