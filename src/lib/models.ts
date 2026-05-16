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
   * Lite model for structured JSON tasks (phrases, evaluation, conversation, questions).
   * Uses the versioned preview identifier.
   */
  FLASH_LITE_PREVIEW: 'gemini-3.1-flash-lite-preview',

  /**
   * Lite model for image scene generation.
   * Uses the latest alias (not the versioned preview).
   */
  FLASH_LITE_LATEST: 'gemini-flash-lite-latest',

  /**
   * Stable production image-generation model (Gemini 2.5 flash image).
   * Typically 5–10s. Same model used in mcp-canva. Llamar vía
   * ai.models.generateContent() con responseModalities: ['IMAGE'].
   */
  IMAGE: 'gemini-2.5-flash-image',
} as const;
