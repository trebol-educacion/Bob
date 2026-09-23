'use server';

import { generateInitialChatAction } from '@/actions/gemini/conversation';
import type { InitialChatResult } from '@/actions/gemini/types';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

const MODE_PROMPT_KEY: Record<PracticeActivityMode, string> = {
  conversation: 'generic_conversation_shared_initial',
  situation: 'practice_situation_shared_initial',
  picture: 'practice_picture_shared_initial',
};

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
