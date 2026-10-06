import type { GoogleGenAI } from '@google/genai';
import { MODELS } from '../../src/lib/models';
import type { PlanPart, SlotContext } from './types';
import type { PlanReview } from './review';

const MAX_ATTEMPTS = 6;

function extractJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

function feedbackOf(errors: string[], previous?: string): string {
  const base = `\n\nYour previous answer was rejected for these reasons, fix all of them and return the complete JSON again:\n- ${errors.slice(0, 12).join('\n- ')}`;
  return previous ? `${base}\n\nYour previous JSON, edit it and change only what is needed to fix those reasons:\n${previous}` : base;
}

function defaultMessage(prompt: string, ctx: SlotContext): string {
  const topic = ctx.topic ? `Topic for this exercise: ${ctx.topic}.` : `This is exercise number ${ctx.slot} of a series.`;
  const avoid = ctx.existing.length > 0 ? ` Do not reuse these existing ones: ${ctx.existing.join(' | ')}.` : '';
  return `${prompt}\n\n${topic}${avoid} Return the JSON only.`;
}

/**
 * @param ai
 * @param part
 * @param prompt generation prompt stored in bob.prompts
 * @param ctx topic and slot of the set
 * @param review structural, rule and judge review
 * @returns plan that passed schema, rules and judge, retrying with the violations as feedback
 */
export async function generatePlan<P>(
  ai: GoogleGenAI,
  part: PlanPart<P>,
  prompt: string,
  ctx: SlotContext,
  review: PlanReview<P>,
): Promise<P> {
  let feedback = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const base = part.message ? await part.message(prompt, ctx) : defaultMessage(prompt, ctx);
    try {
      const result = await ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: `${base}${feedback}` }] }],
        config: { responseMimeType: 'application/json', temperature: 0.9 },
      });
      const rawText = (result.text ?? '').trim();
      const parsed = part.schema.safeParse(extractJson(rawText));
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        console.warn(`[${part.examPart}] attempt ${attempt} rejected: ${errors.slice(0, 5).join('; ')}`);
        feedback = feedbackOf(errors, rawText);
        continue;
      }
      const reviewed = await review(part.normalize ? part.normalize(parsed.data) : parsed.data);
      if (reviewed.errors.length === 0) return reviewed.plan;
      console.warn(`[${part.examPart}] attempt ${attempt} failed review: ${reviewed.errors.slice(0, 5).join('; ')}`);
      feedback = feedbackOf(reviewed.errors, rawText);
    } catch (err) {
      console.warn(`[${part.examPart}] attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      feedback =
        err instanceof SyntaxError
          ? '\n\nYour previous answer was not valid JSON. Return the complete JSON only.'
          : feedbackOf([err instanceof Error ? err.message : String(err)]);
    }
  }
  throw new Error(`No valid plan for ${part.examPart} after ${MAX_ATTEMPTS} attempts`);
}
