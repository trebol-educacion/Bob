'use server';

import { pickPracticeSeed } from '@/lib/practice/seed';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import { generatePracticeInitialTurnAction } from './turn';
import {
  createPracticeSessionAction,
  addPracticeTurnAction,
  findOpenPracticeSessionAction,
  listPracticeMessagesAction,
} from './repository';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { ChatMessage } from '@/actions/gemini/types';
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
  resumed: boolean;
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
  framing: string;
  messages: ChatMessage[];
  turnSignals: PracticeTurnSignal[];
}

const DEFAULT_LEVEL: CefrLevel = 'b1';

/** @param level CefrLevel */
async function tryResumeOpenSession(level: CefrLevel): Promise<StartPracticeResult | null> {
  const found = await findOpenPracticeSessionAction();
  if (!found.ok || !found.data) return null;

  const session = found.data;
  const stored = await listPracticeMessagesAction(session.id);
  if (!stored.ok || stored.data.length === 0) return null;

  const messages: ChatMessage[] = stored.data.map((m) => ({
    role: m.role === 'bob' ? 'model' : 'user',
    text: m.content,
  }));

  const turnSignals: PracticeTurnSignal[] = stored.data
    .filter((m) => m.role === 'student')
    .map((m) => ({
      hasAudio: Boolean(m.audio_url),
      hintUsed: m.hint_used,
      modelAnswerUsed: m.model_answer_used,
      turnScore: null,
    }));

  return {
    sessionId: session.id,
    degraded: false,
    resumed: true,
    mode: session.mode,
    level: session.cefr_level ?? level,
    seed: session.seed ?? pickPracticeSeed(session.mode),
    framing: '',
    messages,
    turnSignals,
  };
}

/** @param input StartPracticeInput */
export async function startPracticeAction(input: StartPracticeInput): Promise<StartPracticeResult> {
  const level = resolveEffectiveLevel(input.skillLevels, input.cefrActiveLevel, 'speaking').level ?? DEFAULT_LEVEL;

  const resumed = await tryResumeOpenSession(level);
  if (resumed) return resumed;

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
    resumed: false,
    mode: input.mode,
    level,
    seed,
    framing: initialTurn.framing,
    messages: [{ role: 'model', text: initialTurn.message }],
    turnSignals: [],
  };
}
