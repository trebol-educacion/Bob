import type { PracticeActivityMode } from './types';

export const MODE_PROMPT_KEY: Record<PracticeActivityMode, string> = {
  conversation: 'generic_conversation_shared_initial',
  situation: 'practice_situation_shared_initial',
  picture: 'practice_picture_shared_initial',
};

const SESSION_MODE_PREFIX = 'practice_';

/**
 * @param sessionMode - mode stored on a session row
 * @returns the practice activity it belongs to, or null for any other session
 */
export function parsePracticeSessionMode(sessionMode: string): PracticeActivityMode | null {
  if (!sessionMode.startsWith(SESSION_MODE_PREFIX)) return null;
  const mode = sessionMode.slice(SESSION_MODE_PREFIX.length);
  return mode in MODE_PROMPT_KEY ? (mode as PracticeActivityMode) : null;
}
