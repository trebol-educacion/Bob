/**
 * Gemini model identifiers used across the application.
 * Kept as separate constants — do NOT unify; each model has distinct capabilities.
 */

/** Display label shown in the chat footer badge: "BOB • Basado en {ACTIVE_MODEL_LABEL}" */
export const ACTIVE_MODEL_LABEL = 'Gemini 2.5 Flash';

/** TTS model — generates native audio output */
export const MODELS = {
  TTS: 'gemini-2.5-flash-preview-tts',

  /**
   * Stable text model for structured JSON tasks (phrases, evaluation, conversation, questions).
   * Aligned with ACTIVE_MODEL_LABEL ("Gemini 2.5 Flash"). Name kept for compat;
   * rename to FLASH_TEXT planned in bob-core B6 (wrapper único).
   */
  FLASH_LITE_PREVIEW: 'gemini-2.5-flash',

  /**
   * Same stable text model used for image-scene description (plain text task).
   * Kept as a distinct constant for now; converges with FLASH_LITE_PREVIEW in B6.
   */
  FLASH_LITE_LATEST: 'gemini-2.5-flash',

  /** Image generation via generateContent + IMAGE modality. */
  IMAGE: 'gemini-2.5-flash-image',
} as const;
