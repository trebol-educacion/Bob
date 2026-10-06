import { z } from 'zod';
import type { GoogleGenAI } from '@google/genai';
import type { Db } from './env';
import { MODELS } from '../../src/lib/models';
import type { Payload } from './schemas';

export type JudgeKind = 'cloze' | 'comprehension' | 'open' | 'transform';

export const JUDGE_KIND: Record<string, JudgeKind> = {
  fce_reading_part1: 'cloze',
  fce_reading_part2: 'open',
  fce_reading_part3: 'open',
  fce_reading_part4: 'transform',
  fce_reading_part5: 'comprehension',
  fce_listening_part1: 'comprehension',
  fce_listening_part2: 'open',
  fce_listening_part4: 'comprehension',
};

const VerdictSchema = z.object({
  number: z.number().int(),
  key_correct: z.boolean(),
  other_correct: z.array(z.string()).default([]),
  issue: z.string().default(''),
  extra_accepted: z.array(z.string()).default([]),
});

const VerdictsSchema = z.object({ items: z.array(VerdictSchema) });

export type Verdict = z.infer<typeof VerdictSchema>;

export type JudgeFn = (kind: JudgeKind, input: unknown) => Promise<Verdict[]>;

const MAX_ATTEMPTS = 3;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOf(index: number, metadata: Record<string, unknown>): number {
  const value = Number(metadata.number);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

function sourceOf(examPart: string, payload: Payload): string | null {
  if (examPart === 'fce_listening_part4') return str(payload.group?.metadata.transcript);
  if (examPart === 'fce_listening_part2') return str(payload.group?.metadata.transcript);
  return payload.group?.stimulus_text ?? null;
}

/**
 * @param examPart
 * @param payload
 * @returns JSON the judge prompt of the part receives
 */
export function buildJudgeInput(examPart: string, payload: Payload): unknown {
  const kind = JUDGE_KIND[examPart];
  const source = sourceOf(examPart, payload);
  const items = payload.items.map((item, index) => {
    const number = numberOf(index, item.metadata);
    if (kind === 'cloze') {
      return { number, options: item.options, claimed_key: item.correct_key };
    }
    if (kind === 'comprehension') {
      return {
        number,
        question: item.question,
        options: item.options,
        claimed_key: item.correct_key,
        ...(item.transcript ? { source: item.transcript } : {}),
      };
    }
    if (kind === 'transform') {
      return {
        number,
        original: item.question,
        keyword: item.metadata.keyword,
        second_sentence_with_gap: item.metadata.second_sentence_with_gap,
        claimed: item.correct_key,
        accepted: item.metadata.accepted,
      };
    }
    return {
      number,
      claimed: item.correct_key,
      accepted: item.metadata.accepted,
      ...(item.metadata.base_word ? { base_word: item.metadata.base_word } : {}),
      ...(item.question.includes('___') ? { sentence: item.question } : {}),
    };
  });
  return { text: source, items };
}

function extractJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

/**
 * @param ai
 * @param db
 * @returns judge that sends the prompt stored in bob.prompts plus the JSON input to Gemini
 */
export function createGeminiJudge(ai: GoogleGenAI, db: Db): JudgeFn {
  const prompts = new Map<string, string>();
  return async (kind, input) => {
    const key = `bob_pregen_judge_${kind}`;
    if (!prompts.has(key)) {
      const { data, error } = await db.from('prompts').select('prompt_current').eq('prompt_key', key).single();
      if (error || !data?.prompt_current) throw new Error(`Judge prompt ${key} not found: ${error?.message ?? 'empty'}`);
      prompts.set(key, data.prompt_current as string);
    }
    let lastError = 'unknown';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
          config: { systemInstruction: prompts.get(key), responseMimeType: 'application/json', temperature: 0 },
        });
        const parsed = VerdictsSchema.safeParse(extractJson(result.text ?? ''));
        if (parsed.success) return parsed.data.items;
        lastError = parsed.error.issues.map((i) => i.message).join('; ');
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(`Judge ${kind} failed: ${lastError}`);
  };
}
