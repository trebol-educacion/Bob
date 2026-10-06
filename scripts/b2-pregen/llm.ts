import type { GoogleGenAI } from '@google/genai';
import type { Db } from './env';
import { MODELS } from '../../src/lib/models';
import { partSpec } from './parts';
import { parsePayload, type Payload } from './schemas';
import type { ReviewResult } from './semantic-checks';

const MAX_ATTEMPTS = 6;

export type Review = (payload: Payload) => Promise<ReviewResult>;

/**
 * @param db
 * @param examPart
 * @returns generation prompt stored in bob.prompts
 */
export async function loadPrompt(db: Db, examPart: string): Promise<string> {
  const promptKey = partSpec(examPart).promptKey;
  const { data, error } = await db.from('prompts').select('prompt_current').eq('prompt_key', promptKey).single();
  if (error || !data?.prompt_current) throw new Error(`Prompt ${promptKey} not found: ${error?.message ?? 'empty'}`);
  return data.prompt_current as string;
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function feedbackOf(errors: string[]): string {
  return `\n\nYour previous answer was rejected for these reasons, fix all of them and return the complete JSON again:\n- ${errors.slice(0, 12).join('\n- ')}`;
}

/**
 * @param ai
 * @param prompt
 * @param examPart
 * @param topic
 * @param review semantic review run after structural validation
 * @returns payload that passed structure and semantic review, retrying with the violations as feedback
 */
export async function generatePayload(
  ai: GoogleGenAI,
  prompt: string,
  examPart: string,
  topic: string,
  review: Review,
): Promise<Payload> {
  const spec = partSpec(examPart);
  let feedback = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = `${spec.userMessage(topic)}${feedback}`;
    try {
      const result = await ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: message }] }],
        config: { systemInstruction: spec.systemPrompt(prompt, topic), responseMimeType: 'application/json', temperature: 0.9 },
      });
      const raw = extractJson(result.text ?? '');
      const parsed = parsePayload(examPart, spec.adapt ? spec.adapt(raw, topic) : raw);
      if (!parsed.ok) {
        console.warn(`[${examPart}] attempt ${attempt} rejected: ${parsed.errors.slice(0, 6).join('; ')}`);
        feedback = feedbackOf(parsed.errors);
        continue;
      }
      const reviewed = await review(parsed.data);
      if (reviewed.errors.length === 0) return reviewed.payload;
      console.warn(`[${examPart}] attempt ${attempt} failed review: ${reviewed.errors.slice(0, 6).join('; ')}`);
      feedback = feedbackOf(reviewed.errors);
    } catch (err) {
      console.warn(`[${examPart}] attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      feedback =
        err instanceof SyntaxError
          ? '\n\nYour previous answer was not valid JSON. Return the complete JSON only.'
          : feedbackOf([err instanceof Error ? err.message : String(err)]);
    }
  }
  throw new Error(`No valid payload for ${examPart} after ${MAX_ATTEMPTS} attempts`);
}
