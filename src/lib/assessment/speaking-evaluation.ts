import 'server-only';

import { Type, type Part } from '@google/genai';
import { z } from 'zod';
import { callGemini } from '@/lib/gemini-client';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { MODELS } from '@/lib/models';
import type { SubmitSpeakingTurn } from '@/actions/assessment/types';
import { parseModelJson } from '@/lib/llm/parse-model-json';

const NO_TRANSCRIPT = '[no transcript]';

export const speakingEvaluationSchema = z.object({
  cefr_band: z.enum(['pre_a1', 'a1', 'a2', 'b1', 'b2']),
  confidence: z.enum(['low', 'medium', 'high']),
  feedback: z.object({
    kind: z.string(),
    highlights: z.array(z.string()),
    suggestions: z.array(z.string()),
    overall_message: z.string(),
  }),
});

export type SpeakingEvaluation = z.infer<typeof speakingEvaluationSchema>;

export type SpeakingEvaluationOutcome =
  | { ok: true; evaluation: SpeakingEvaluation }
  | { ok: false; error: string };

export interface SpeakingEvaluationInput {
  turns: SubmitSpeakingTurn[];
  currentLevel: string;
  isYl: boolean;
  userId: string;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cefr_band: { type: Type.STRING },
    confidence: { type: Type.STRING },
    feedback: {
      type: Type.OBJECT,
      properties: {
        kind: { type: Type.STRING },
        highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        overall_message: { type: Type.STRING },
      },
      required: ['kind', 'highlights', 'suggestions', 'overall_message'],
    },
  },
  required: ['cefr_band', 'confidence', 'feedback'],
};

/**
 * @param currentLevel string
 * @param isYl boolean
 * @returns string prompt key in bob.prompts
 */
export function buildSpeakingEvalKey(currentLevel: string, isYl: boolean): string {
  if (isYl) {
    return currentLevel === 'pre_a1'
      ? 'cefr_assessment_speaking_yl_pre_a1_evaluation'
      : 'cefr_assessment_speaking_yl_a1_evaluation';
  }
  const higherRange = currentLevel === 'b1' || currentLevel === 'b2';
  return higherRange
    ? 'cefr_assessment_speaking_b1_b2_evaluation'
    : 'cefr_assessment_speaking_a1_a2_evaluation';
}

/**
 * @param turns SubmitSpeakingTurn[]
 * @returns string one "Turn N: text" line per turn
 */
export function buildTranscripts(turns: SubmitSpeakingTurn[]): string {
  return turns
    .map((turn, index) => `Turn ${index + 1}: ${turn.transcript ?? NO_TRANSCRIPT}`)
    .join('\n');
}

/**
 * @param turns SubmitSpeakingTurn[]
 * @returns Part[] inlineData parts for turns that carry audio
 */
export function buildAudioParts(turns: SubmitSpeakingTurn[]): Part[] {
  return turns
    .filter((turn) => turn.audio_base64 && turn.mime_type)
    .map((turn) => ({ inlineData: { data: turn.audio_base64, mimeType: turn.mime_type } }));
}

/**
 * @param raw string | undefined model JSON output
 * @returns SpeakingEvaluationOutcome validated result or error
 */
export function parseSpeakingEvaluation(raw: string | undefined): SpeakingEvaluationOutcome {
  if (!raw) return { ok: false, error: 'empty_response' };
  let json: unknown;
  try {
    json = parseModelJson(raw);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  const parsed = speakingEvaluationSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'invalid_evaluation' };
  return { ok: true, evaluation: parsed.data };
}

/**
 * @param input SpeakingEvaluationInput
 * @returns Promise<SpeakingEvaluationOutcome> never throws
 */
export async function evaluateSpeakingAssessment(
  input: SpeakingEvaluationInput
): Promise<SpeakingEvaluationOutcome> {
  const audioParts = buildAudioParts(input.turns);
  if (audioParts.length === 0) return { ok: false, error: 'no_audio' };

  const promptKey = buildSpeakingEvalKey(input.currentLevel, input.isYl);
  let promptText: string;
  try {
    promptText = await getPrompt(promptKey, { TRANSCRIPTS: buildTranscripts(input.turns) });
  } catch {
    return { ok: false, error: `prompt_not_found:${promptKey}` };
  }

  const result = await callGemini(
    { promptKey, model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [...audioParts, { text: promptText }] }],
      config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    })
  );
  if (!result.ok) return { ok: false, error: `gemini_${result.code}` };

  return parseSpeakingEvaluation(result.data.text);
}
