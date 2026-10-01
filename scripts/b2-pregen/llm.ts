import type { GoogleGenAI } from '@google/genai';
import type { Db } from './env';
import { MODELS } from '../../src/lib/models';
import { parsePayload, type Payload } from './schemas';

const MAX_ATTEMPTS = 6;

/**
 * @param db
 * @param examPart
 * @returns generation prompt stored in bob.prompts
 */
export async function loadPrompt(db: Db, examPart: string): Promise<string> {
  const promptKey = `cambridge_${examPart}_b2_generation`;
  const { data, error } = await db.from('prompts').select('prompt_current').eq('prompt_key', promptKey).single();
  if (error || !data?.prompt_current) throw new Error(`Prompt ${promptKey} not found: ${error?.message ?? 'empty'}`);
  return data.prompt_current as string;
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/**
 * @param ai
 * @param prompt
 * @param examPart
 * @param topic
 * @returns payload validated against the part schema, retrying with the violations as feedback
 */
export async function generatePayload(
  ai: GoogleGenAI,
  prompt: string,
  examPart: string,
  topic: string,
): Promise<Payload> {
  let feedback = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = `Topic: ${topic}. Return the JSON only.${feedback}`;
    try {
      const result = await ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: message }] }],
        config: { systemInstruction: prompt, responseMimeType: 'application/json', temperature: 0.9 },
      });
      const parsed = parsePayload(examPart, extractJson(result.text ?? ''));
      if (parsed.ok) return parsed.data;
      console.warn(`[${examPart}] attempt ${attempt} rejected: ${parsed.errors.slice(0, 6).join('; ')}`);
      feedback = `\n\nYour previous answer was rejected for these reasons, fix all of them and return the complete JSON again:\n- ${parsed.errors.slice(0, 12).join('\n- ')}`;
    } catch (err) {
      console.warn(`[${examPart}] attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      feedback = '\n\nYour previous answer was not valid JSON. Return the complete JSON only.';
    }
  }
  throw new Error(`No valid payload for ${examPart} after ${MAX_ATTEMPTS} attempts`);
}
