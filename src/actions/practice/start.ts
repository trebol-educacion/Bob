'use server';

import { pickPracticeSeed } from '@/lib/practice/seed';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import { generatePracticeInitialTurnAction } from './turn';
import { createPracticeSessionAction, addPracticeTurnAction } from './repository';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface StartPracticeInput {
  mode: PracticeActivityMode;
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
  organizationId: string | null;
}

export interface StartPracticeResult {
  sessionId: string | null;
  degraded: boolean;
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
  framing: string;
  message: string;
}

const DEFAULT_LEVEL: CefrLevel = 'b1';

/** @param input StartPracticeInput */
export async function startPracticeAction(input: StartPracticeInput): Promise<StartPracticeResult> {
  const level = resolveEffectiveLevel(input.skillLevels, input.cefrActiveLevel, 'speaking').level ?? DEFAULT_LEVEL;
  const seed = pickPracticeSeed(input.mode);

  const created = await createPracticeSessionAction({
    mode: input.mode,
    topic: seed.topic,
    cefrLevel: level,
    seed,
    organizationId: input.organizationId,
  });

  const sessionId = created.ok ? created.data.id : null;
  const degraded = !created.ok;

  const initialTurn = await generatePracticeInitialTurnAction(input.mode, seed, level);

  if (sessionId) {
    void addPracticeTurnAction({ sessionId, role: 'bob', content: initialTurn.message });
  }

  return {
    sessionId,
    degraded,
    mode: input.mode,
    level,
    seed,
    framing: initialTurn.framing,
    message: initialTurn.message,
  };
}
