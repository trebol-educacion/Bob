'use server';

import { ensureSession, recordTurn } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { MODE_PROMPT_KEY } from '@/lib/practice/mode-prompt-key';
import {
  buildExchangeMessages,
  buildOpeningMessages,
  type PracticeOpening,
  type PracticeStudentTurn,
} from '@/lib/practice/messages';
import { createPracticeSidecar, discardPracticeSession } from '@/lib/practice/sidecar';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export interface RecordPracticeTurnInput {
  sessionId: string | null;
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
  organizationId: string | null;
  opening: PracticeOpening;
  student: PracticeStudentTurn;
  botText: string;
}

/**
 * @param input.sessionId - existing session; null creates it with this first exchange
 * @param input.opening - first Bob message and scene, persisted only when the session is created
 * @param input.student - student text with its scaffolding signals
 * @param input.botText - Bob reply
 * @returns session id after the whole exchange was persisted with await
 */
export async function recordPracticeTurnAction(input: RecordPracticeTurnInput): Promise<ActionResult<{ sessionId: string }>> {
  if (!(input.mode in MODE_PROMPT_KEY)) return fail('invalid_mode');

  const ensured = await ensureSession({
    mode: `practice_${input.mode}`,
    sessionId: input.sessionId,
    topic: input.seed.topic,
  });
  if (!ensured.ok) return ensured;

  const { sessionId, userId, created } = ensured.data;
  const exchange = buildExchangeMessages(input.student, input.botText);

  if (created) {
    const sidecar = await createPracticeSidecar({
      sessionId,
      userId,
      organizationId: input.organizationId,
      mode: input.mode,
      level: input.level,
      seed: input.seed,
    });
    if (!sidecar.ok) {
      await discardPracticeSession(sessionId);
      return sidecar;
    }
  }

  const messages = created ? [...buildOpeningMessages(input.opening), ...exchange] : exchange;
  const recorded = await recordTurn({ sessionId, userId, messages });
  if (!recorded.ok) {
    if (created) await discardPracticeSession(sessionId);
    return recorded;
  }
  return ok({ sessionId });
}
