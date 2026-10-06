'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { preparePracticeAction } from '@/actions/practice/start';
import { getPracticeResumeAction } from '@/actions/practice/resume';
import { streamInitialTurn } from '@/lib/practice/stream-initial-turn';
import { restorePractice, type PracticeResultPayload, type StoredPracticeMessage } from '@/lib/practice/messages';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { PracticeTurnSignal } from '@/lib/grading/practice-rubric';
import type { ChatMessage } from '@/actions/gemini/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PracticeResumeInput {
  sessionId: string;
  messages: StoredPracticeMessage[];
}

export interface UsePracticeBootArgs {
  mode: PracticeActivityMode;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  resume?: PracticeResumeInput;
}

export interface PracticeReadyState {
  phase: 'ready';
  sessionId: string | null;
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
  framing: string;
  messages: ChatMessage[];
  turnSignals: PracticeTurnSignal[];
  imageUrl: string | null;
  result: PracticeResultPayload | null;
}

export type PracticeBootState =
  | { phase: 'booting'; framing: string; message: string }
  | { phase: 'error'; code: string; retryable: boolean }
  | PracticeReadyState;

const BOOTING: PracticeBootState = { phase: 'booting', framing: '', message: '' };
const BOOT_FAILED: PracticeBootState = { phase: 'error', code: 'boot_failed', retryable: true };

async function bootResumed(resume: PracticeResumeInput): Promise<PracticeBootState> {
  const meta = await getPracticeResumeAction(resume.sessionId);
  if (!meta.ok) return { phase: 'error', code: meta.code, retryable: meta.retryable };
  const restored = restorePractice(resume.messages);
  return {
    phase: 'ready',
    sessionId: resume.sessionId,
    mode: meta.data.mode,
    seed: meta.data.seed,
    level: meta.data.level,
    framing: restored.framing,
    messages: restored.messages,
    turnSignals: restored.turnSignals,
    imageUrl: restored.imageUrl,
    result: restored.result,
  };
}

/**
 * @param args - mode and level inputs read once per attempt; resume reopens a stored session
 * @returns boot state machine, a restart callback and an instance key that changes on every restart
 */
export function usePracticeBoot(args: UsePracticeBootArgs): PracticeBootState & { restart: () => void; instance: number } {
  const argsRef = useRef(args);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PracticeBootState>(BOOTING);
  const resumeId = args.resume?.sessionId ?? null;

  useEffect(() => {
    const { mode, skillLevels, cefrActiveLevel, resume } = argsRef.current;
    const controller = new AbortController();

    const run = async (): Promise<PracticeBootState | null> => {
      if (resume) return bootResumed(resume);

      const prepared = await preparePracticeAction({ mode, skillLevels, cefrActiveLevel });
      if (!prepared.ok) return { phase: 'error', code: prepared.code, retryable: prepared.retryable };
      const { level, seed } = prepared.data;

      const opening = await streamInitialTurn(
        { mode, seed, level },
        {
          signal: controller.signal,
          onUpdate: ({ framing, message }) => setState({ phase: 'booting', framing, message }),
        }
      );
      if (!opening.ok) {
        return opening.aborted ? null : { phase: 'error', code: opening.code, retryable: opening.retryable };
      }
      return {
        phase: 'ready',
        sessionId: null,
        mode,
        seed,
        level,
        framing: opening.framing,
        messages: [{ role: 'model', text: opening.message }],
        turnSignals: [],
        imageUrl: null,
        result: null,
      };
    };

    run()
      .then((next) => {
        if (next && !controller.signal.aborted) setState(next);
      })
      .catch((error) => {
        console.error('[usePracticeBoot] boot failed:', error);
        if (!controller.signal.aborted) setState(BOOT_FAILED);
      });

    return () => controller.abort();
  }, [attempt, resumeId]);

  const restart = useCallback(() => {
    setState(BOOTING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, restart, instance: attempt };
}
