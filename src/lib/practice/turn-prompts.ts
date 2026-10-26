import type { PracticeActivityMode } from './types';

export const LEGACY_TURN_PROMPT_KEY = 'generic_conversation_shared_eval_audio';

export const MODE_TURN_PROMPT_KEY: Record<PracticeActivityMode, string> = {
  conversation: 'practice_shared_eval_turn',
  situation: 'practice_shared_eval_turn',
  picture: 'practice_shared_eval_turn',
  presentation: 'practice_presentation_shared_eval_turn',
};
