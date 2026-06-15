import 'server-only';

/** Builds a Gemini image generation prompt for a challenge image slot. */
export function buildChallengePrompt(description: string, kind: string): string {
  if (kind === 'story') {
    return `Scene for a picture story. ${description}. Flat illustration style, plain background, no text, no letters, no numbers.`;
  }
  if (kind === 'collaborative') {
    return `Scene with multiple elements for discussion. ${description}. Flat illustration style, plain background, no text, no letters, no numbers.`;
  }
  return `Simple, clear, friendly flat illustration for an English A2 exam. ${description}. Single clear subject, plain background, no text, no letters, no words, no numbers.`;
}

/** Returns the storage path for a versioned challenge image. */
export function challengeStoragePath(slotKey: string, version: number): string {
  const safe = slotKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `challenge/${safe}/v${version}.png`;
}
