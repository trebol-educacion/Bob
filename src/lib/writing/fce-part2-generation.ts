import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { parseJsonResult } from '@/lib/llm/parse-json-result';
import type { ActionResult } from '@/lib/result';
import { getOrCreateCachedContent } from '@/lib/cache';
import type { CacheKey } from '@/lib/cache-keys';
import { MODELS } from '@/lib/models';
import type { BobDbClient } from '@/lib/supabase/admin';
import {
  FCE_PART2_POOL_SIZE,
  FcePart2GenerationSchema,
  type FcePart2Generation,
} from '@/lib/writing/fce-part2';

export const FCE_PART2_GENERATION_KEY = 'cambridge_fce_writing_part2_b2_generation';

export interface FcePart2GenerationOptions {
  userId?: string;
  client?: BobDbClient;
}

/**
 * @param random () => number
 * @returns variant index within the Writing Part 2 pool
 */
export function pickFcePart2Variant(random: () => number = Math.random): number {
  return Math.floor(random() * FCE_PART2_POOL_SIZE);
}

/**
 * @param variant number
 * @returns cache key for that Writing Part 2 variant
 */
export function fcePart2CacheKey(variant: number): CacheKey {
  return { kind: 'plan', promptKey: FCE_PART2_GENERATION_KEY, inputs: { variant } };
}

/**
 * @param value FcePart2Generation
 * @returns whether the value satisfies the generation schema
 */
export function isValidFcePart2Generation(value: FcePart2Generation): boolean {
  return FcePart2GenerationSchema.safeParse(value).success;
}

async function generateFcePart2Tasks(options: FcePart2GenerationOptions): Promise<ActionResult<FcePart2Generation>> {
  const promptText = await getPrompt(FCE_PART2_GENERATION_KEY, undefined, options.client);
  const result = await callGemini(
    { promptKey: FCE_PART2_GENERATION_KEY, model: MODELS.FLASH_LITE_PREVIEW, userId: options.userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
  );
  return parseJsonResult<FcePart2Generation>(
    result.ok ? { ...result, data: { text: result.data.candidates?.[0]?.content?.parts?.[0]?.text } } : result,
    FcePart2GenerationSchema,
    'generateFcePart2Tasks',
  );
}

/**
 * @param variant number
 * @param options FcePart2GenerationOptions
 * @returns cached or freshly generated tasks, or an error object
 */
export function getFcePart2Generation(
  variant: number,
  options: FcePart2GenerationOptions = {},
): Promise<FcePart2Generation | { error: string }> {
  return getOrCreateCachedContent<FcePart2Generation>(
    fcePart2CacheKey(variant),
    () => generateFcePart2Tasks(options),
    { validate: isValidFcePart2Generation, client: options.client },
  );
}
