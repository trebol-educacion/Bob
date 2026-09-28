'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolvePracticeSessionAction } from '@/actions/practice/start';
import { addPracticeTurnAction } from '@/actions/practice/repository';
import { streamInitialTurn } from '@/lib/practice/stream-initial-turn';
import { pickPracticeSeed } from '@/lib/practice/seed';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { ChatMessage } from '@/actions/gemini/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';
import type { Organization } from '@/lib/organization';

export interface UsePracticeBootArgs {
  mode: PracticeActivityMode;
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
}

export interface PracticeBootState {
  phase: 'booting' | 'ready';
  framing: string;
  message: string;
  sessionId: string | null;
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
  messages: ChatMessage[];
  turnSignals: PracticeTurnSignal[];
}

const DEFAULT_LEVEL: CefrLevel = 'b1';

/** @param args UsePracticeBootArgs */
function buildBootingState(args: UsePracticeBootArgs, seed: PracticeSeed, level: CefrLevel): PracticeBootState {
  return {
    phase: 'booting',
    framing: '',
    message: '',
    sessionId: null,
    mode: args.mode,
    seed,
    level,
    messages: [],
    turnSignals: [],
  };
}

/**
 * @param args UsePracticeBootArgs
 * @returns PracticeBootState and a restart callback
 */
export function usePracticeBoot(args: UsePracticeBootArgs): PracticeBootState & { restart: () => void } {
  const { mode, organization, cefrActiveLevel, skillLevels } = args;
  const [attempt, setAttempt] = useState(0);

  const level = useMemo(
    () => resolveEffectiveLevel(skillLevels, cefrActiveLevel, 'speaking').level ?? DEFAULT_LEVEL,
    [skillLevels, cefrActiveLevel]
  );

  const [state, setState] = useState<PracticeBootState>(() => buildBootingState(args, pickPracticeSeed(mode), level));

  useEffect(() => {
    const seed = pickPracticeSeed(mode);
    const controller = new AbortController();
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(buildBootingState(args, seed, level));

    const streamPromise = streamInitialTurn(
      { mode, seed, level },
      {
        signal: controller.signal,
        onUpdate: ({ framing, message }) => {
          if (cancelled) return;
          setState((prev) => (prev.phase === 'ready' ? prev : { ...prev, framing, message }));
        },
      }
    );

    (async () => {
      try {
        const session = await resolvePracticeSessionAction({
          mode,
          skillLevels,
          cefrActiveLevel,
          organizationId: organization?.id ?? null,
        });
        if (cancelled) return;

        if (session.resumed) {
          controller.abort();
          setState({
            phase: 'ready',
            framing: '',
            message: '',
            sessionId: session.sessionId,
            mode: session.mode,
            seed: session.seed,
            level: session.level,
            messages: session.messages,
            turnSignals: session.turnSignals,
          });
          return;
        }

        const streamed = await streamPromise;
        if (cancelled) return;

        if (session.sessionId && streamed.message) {
          void addPracticeTurnAction({
            sessionId: session.sessionId,
            role: 'bob',
            content: streamed.message,
          }).catch((error) => console.error('[usePracticeBoot] persist initial turn failed:', error));
        }

        setState({
          phase: 'ready',
          framing: streamed.framing,
          message: streamed.message,
          sessionId: session.sessionId,
          mode: session.mode,
          seed: session.seed,
          level: session.level,
          messages: streamed.message ? [{ role: 'model', text: streamed.message }] : [],
          turnSignals: [],
        });
      } catch (error) {
        if (cancelled) return;
        console.error('[usePracticeBoot] boot failed:', error);
        setState((prev) => ({ ...prev, phase: 'ready' }));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, skillLevels, cefrActiveLevel, organization, level, attempt]);

  return { ...state, restart: () => setAttempt((n) => n + 1) };
}
