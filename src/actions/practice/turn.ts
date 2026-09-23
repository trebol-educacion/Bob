'use server';

import { generateInitialChatAction } from '@/actions/gemini/conversation';
import { MODE_PROMPT_KEY } from '@/lib/practice/mode-prompt-key';
import type { InitialChatResult } from '@/actions/gemini/types';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

/**
 * @param mode PracticeActivityMode
 * @param seed PracticeSeed
 * @param level CefrLevel
 * @returns InitialChatResult
 */
export async function generatePracticeInitialTurnAction(
  mode: PracticeActivityMode,
  seed: PracticeSeed,
  level: CefrLevel
): Promise<InitialChatResult> {
  return generateInitialChatAction(seed.topic, level, MODE_PROMPT_KEY[mode], {
    CHARACTER: seed.character,
  });
}
