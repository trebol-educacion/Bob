'use server';

import { pickPracticeSeed } from '@/lib/practice/seed';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import { MODE_PROMPT_KEY } from '@/lib/practice/mode-prompt-key';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PreparePracticeInput {
  mode: PracticeActivityMode;
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
}

export interface PreparedPractice {
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
}

const DEFAULT_LEVEL: CefrLevel = 'b1';

/**
 * @param input.mode - practice activity chosen by the student
 * @param input.skillLevels - per-skill levels of the student
 * @param input.cefrActiveLevel - level fixed by the tenant, when locked
 * @returns effective level and the only seed of the run; creates no session and calls no LLM
 */
export async function preparePracticeAction(input: PreparePracticeInput): Promise<ActionResult<PreparedPractice>> {
  if (!(input.mode in MODE_PROMPT_KEY)) return fail('invalid_mode');
  const level = resolveEffectiveLevel(input.skillLevels, input.cefrActiveLevel, 'speaking').level ?? DEFAULT_LEVEL;
  return ok({ mode: input.mode, level, seed: pickPracticeSeed(input.mode) });
}
