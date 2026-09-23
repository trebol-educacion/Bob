import type { PracticeActivityMode } from './types';

export const MODE_PROMPT_KEY: Record<PracticeActivityMode, string> = {
  conversation: 'generic_conversation_shared_initial',
  situation: 'practice_situation_shared_initial',
  picture: 'practice_picture_shared_initial',
};
