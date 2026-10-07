/**
 * @param scene
 * @param characterDescription
 * @param imageType
 */
export function buildDirectImagenPrompt(
  scene: string,
  characterDescription?: string,
  imageType: 'scene' | 'object_card' | 'photo_realistic' = 'scene'
): string {
  if (imageType === 'photo_realistic') {
    const parts = [`Scene: ${scene.trim()}`];
    if (characterDescription) {
      parts.push(`Include this person consistently: ${characterDescription.trim()}.`);
    }
    return parts.join(' ');
  }

  const parts = [
    "Flat children's book illustration for a Cambridge Young Learners English activity.",
    `Scene: ${scene.trim()}`,
  ];
  if (characterDescription) {
    parts.push(`Include this character consistently: ${characterDescription.trim()}.`);
  }
  parts.push(
    'Style: bright cheerful pastel colors, simple clear composition, no text or letters in the image, objects clearly identifiable at Pre-A1 vocabulary level.'
  );
  return parts.join(' ');
}
