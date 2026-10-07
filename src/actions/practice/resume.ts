'use server';

import { getPracticeSidecar } from '@/lib/practice/sidecar';
import { pickPracticeSeed } from '@/lib/practice/seed';
import { fail, ok, type ActionResult } from '@/lib/result';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export interface PracticeResumeMeta {
  mode: PracticeActivityMode;
  level: CefrLevel;
  seed: PracticeSeed;
  finished: boolean;
}

const DEFAULT_LEVEL: CefrLevel = 'b1';

/**
 * @param sessionId - canonical session id chosen in the sidebar
 * @returns mode, level and seed stored when the session was created
 */
export async function getPracticeResumeAction(sessionId: string): Promise<ActionResult<PracticeResumeMeta>> {
  const sidecar = await getPracticeSidecar(sessionId);
  if (!sidecar.ok) return fail(sidecar.code, sidecar.retryable);
  const { mode, level, seed, endedAt } = sidecar.data;
  return ok({
    mode,
    level: level ?? DEFAULT_LEVEL,
    seed: seed ?? pickPracticeSeed(mode),
    finished: endedAt !== null,
  });
}
