const KIDS_STYLE =
  'Style: bright cheerful pastel colors, simple clear composition, no text or letters in the image, objects clearly identifiable at A2 vocabulary level.';

/**
 * @param scene one-sentence scene description
 * @returns full image prompt in the flat children's illustration style used by the Cambridge YL and KET activities
 */
export function kidsImagePrompt(scene: string): string {
  return [
    "Flat children's book illustration for a Cambridge English activity.",
    `Scene: ${scene.trim()}`,
    KIDS_STYLE,
  ].join(' ');
}
