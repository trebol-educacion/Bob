import 'server-only';

import { MODELS } from '@/lib/models';
import { callGemini } from '@/lib/gemini-client';

/** Fallback when Imagen returns an empty batch (uses generateContent + IMAGE modality). */
export const YL_IMAGE_FLASH_MODEL = 'gemini-2.5-flash-image';

/** Visible placeholder — not a transparent pixel. */
export const YL_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#E5E7EB"/><circle cx="200" cy="160" r="48" fill="#9CA3AF"/><rect x="120" y="230" width="160" height="100" rx="12" fill="#9CA3AF"/><text x="200" y="370" text-anchor="middle" fill="#6B7280" font-family="sans-serif" font-size="14">Image unavailable</text></svg>'
  );

type ImagePayload = { imageBytes?: unknown; imageBytesBase64?: unknown; mimeType?: string };

/** Builds a direct Imagen prompt (no meta-instructions like "Return the enhanced prompt"). */
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

function bytesToBase64(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 100) {
    return value;
  }
  if (value instanceof Uint8Array && value.length > 100) {
    return Buffer.from(value).toString('base64');
  }
  if (Array.isArray(value) && value.length > 100) {
    return Buffer.from(value).toString('base64');
  }
  return null;
}

function normalizeImagePayload(image: ImagePayload | undefined): { b64: string; mime: string } | null {
  if (!image) return null;
  const b64 = bytesToBase64(image.imageBytes) ?? bytesToBase64(image.imageBytesBase64);
  if (!b64) return null;
  return { b64, mime: image.mimeType ?? 'image/png' };
}

/** Parses `generateImages` response (Imagen 4). */
export function extractFromGenerateImagesResponse(data: unknown): { b64: string; mime: string } | null {
  const raw = data as { generatedImages?: Array<{ image?: ImagePayload; raiFilteredReason?: string }> };
  const items = raw?.generatedImages ?? [];
  if (items.length === 0) return null;
  const reason = items[0]?.raiFilteredReason;
  if (reason) {
    console.warn(JSON.stringify({ event: 'yl_imagen_rai_filtered', reason }));
  }
  return normalizeImagePayload(items[0]?.image);
}

/** Parses `generateContent` response with IMAGE modality (Gemini Flash Image). */
export function extractFromGenerateContentResponse(data: unknown): { b64: string; mime: string } | null {
  const raw = data as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const parts = raw.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    const b64 = inline?.data;
    if (b64 && b64.length > 100) {
      return { b64, mime: inline?.mimeType ?? 'image/png' };
    }
  }
  return null;
}

/**
 * Tries Imagen `generateImages` (2 attempts), then Gemini Flash Image via `generateContent`.
 */
export async function generateImageWithFallback(
  promptKey: string,
  imagenPrompt: string
): Promise<{ b64: string; mime: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini(
      { promptKey, model: MODELS.IMAGE },
      (ai) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ai.models as any).generateImages({
          model: MODELS.IMAGE,
          prompt: imagenPrompt,
          config: { numberOfImages: 1, aspectRatio: '1:1' },
        })
    );

    if (!result.ok) {
      console.warn(
        JSON.stringify({ event: 'yl_imagen_error', method: 'generateImages', attempt, error: result.error })
      );
      continue;
    }

    const extracted = extractFromGenerateImagesResponse(result.data);
    if (extracted) return extracted;

    const raw = result.data as { generatedImages?: unknown[] };
    console.warn(
      JSON.stringify({
        event: 'yl_imagen_empty',
        method: 'generateImages',
        attempt,
        count: raw?.generatedImages?.length ?? 0,
      })
    );
  }

  const flashResult = await callGemini(
    { promptKey: `${promptKey}_flash`, model: YL_IMAGE_FLASH_MODEL },
    (ai) =>
      ai.models.generateContent({
        model: YL_IMAGE_FLASH_MODEL,
        contents: [{ role: 'user', parts: [{ text: imagenPrompt }] }],
        config: { responseModalities: ['IMAGE'] },
      })
  );

  if (!flashResult.ok) {
    console.warn(
      JSON.stringify({ event: 'yl_imagen_error', method: 'generateContent', error: flashResult.error })
    );
    return null;
  }

  return extractFromGenerateContentResponse(flashResult.data);
}
