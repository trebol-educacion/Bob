/**
 * Gemini model identifiers used across the application.
 * Kept as separate constants — do NOT unify; each model has distinct capabilities.
 */

/** TTS model — generates native audio output */
export const MODELS = {
  TTS: 'gemini-2.5-flash-preview-tts',

  /**
   * Lite model for structured JSON tasks (phrases, evaluation, conversation, questions).
   * Uses the versioned preview identifier.
   */
  FLASH_LITE_PREVIEW: 'gemini-3.1-flash-lite-preview',

  /**
   * Lite model for image scene generation.
   * Uses the latest alias (not the versioned preview).
   */
  FLASH_LITE_LATEST: 'gemini-flash-lite-latest',

  /** Full image generation model */
  IMAGE: 'gemini-3.1-flash-image-preview',
} as const;
