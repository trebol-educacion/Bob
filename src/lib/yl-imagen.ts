import 'server-only';

import { callGemini } from '@/lib/gemini-client';

const FLASH_IMAGE_MODEL = 'gemini-2.5-flash-image';

/** Visible placeholder — not a transparent pixel. */
export const YL_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#E5E7EB"/><circle cx="200" cy="160" r="48" fill="#9CA3AF"/><rect x="120" y="230" width="160" height="100" rx="12" fill="#9CA3AF"/><text x="200" y="370" text-anchor="middle" fill="#6B7280" font-family="sans-serif" font-size="14">Image unavailable</text></svg>'
  );

export function buildDirectImagenPrompt(scene: string, characterDescription?: string): string {
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

/** Generates a YL image via gemini-2.5-flash-image (generateContent + IMAGE modality). */
export async function generateImageWithFallback(
  promptKey: string,
  prompt: string
): Promise<{ b64: string; mime: string } | null> {
  const result = await callGemini(
    { promptKey, model: FLASH_IMAGE_MODEL },
    (ai) =>
      ai.models.generateContent({
        model: FLASH_IMAGE_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseModalities: ['IMAGE'] },
      })
  );

  if (!result.ok) {
    console.warn(JSON.stringify({ event: 'yl_image_error', error: result.error }));
    return null;
  }

  const raw = result.data as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const parts = raw.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data && inline.data.length > 100) {
      return { b64: inline.data, mime: inline.mimeType ?? 'image/png' };
    }
  }

  console.warn(JSON.stringify({ event: 'yl_image_empty', promptKey }));
  return null;
}
