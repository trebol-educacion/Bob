const DEFAULT_MODELS = {
  TEXT: 'gemini-3-flash-preview',
  FAST: 'gemini-flash-lite-latest',
  IMAGE: 'gemini-3-pro-image-preview',
  TTS: 'gemini-2.5-flash-preview-tts',
} as const;

/**
 * @param name - environment variable holding the model id
 * @param fallback - model id used when the variable is unset or blank
 * @returns model id
 */
function modelFromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

const TEXT_MODEL = modelFromEnv('GEMINI_TEXT_MODEL', DEFAULT_MODELS.TEXT);

export const MODELS = {
  TTS: modelFromEnv('GEMINI_TTS_MODEL', DEFAULT_MODELS.TTS),
  FLASH_LITE_PREVIEW: TEXT_MODEL,
  FLASH_LITE_LATEST: TEXT_MODEL,
  FLASH_LITE: modelFromEnv('GEMINI_FAST_MODEL', DEFAULT_MODELS.FAST),
  IMAGE: modelFromEnv('GEMINI_IMAGE_MODEL', DEFAULT_MODELS.IMAGE),
} as const;
