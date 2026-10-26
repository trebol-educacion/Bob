import { Type } from '@google/genai';
import type { Part } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { parseModelJson } from '@/lib/llm/parse-model-json';
import { ChatTurnSchema } from '@/lib/types/gemini';
import { readTurnCriteria, type PracticeTurnCriteria } from '@/lib/grading/practice-criteria';
import { LEGACY_TURN_PROMPT_KEY, MODE_TURN_PROMPT_KEY } from './turn-prompts';
import type { ChatMessage, ChatTurnResult } from '@/actions/gemini/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode } from './types';

export interface PracticeTurnResult extends ChatTurnResult {
  criteria: PracticeTurnCriteria | null;
}

export interface PracticeTurnInput {
  mode: PracticeActivityMode;
  history: ChatMessage[];
  studentParts: Part[];
  hasAudio: boolean;
  fallbackTranscript: string;
  topic: string;
  level: CefrLevel;
}

function responseSchema(withCriteria: boolean) {
  const evaluation = {
    score: { type: Type.NUMBER },
    feedback: { type: Type.STRING },
    transcribed_text: { type: Type.STRING },
    ...(withCriteria
      ? {
          criteria: {
            type: Type.OBJECT,
            properties: {
              pronunciation: { type: Type.NUMBER, nullable: true },
              fluency: { type: Type.NUMBER },
              grammar: { type: Type.NUMBER },
              vocabulary: { type: Type.NUMBER },
            },
            required: ['fluency', 'grammar', 'vocabulary'],
          },
        }
      : {}),
  };
  return {
    type: Type.OBJECT,
    properties: {
      evaluation: {
        type: Type.OBJECT,
        properties: evaluation,
        required: ['score', 'feedback', 'transcribed_text'],
      },
      ai_response: { type: Type.STRING },
    },
    required: ['evaluation', 'ai_response'],
  };
}

async function resolvePrompt(
  mode: PracticeActivityMode,
  topic: string,
  level: CefrLevel
): Promise<{ key: string; text: string; withCriteria: boolean }> {
  const params = { TOPIC: topic, CEFR_LEVEL: level };
  const key = MODE_TURN_PROMPT_KEY[mode];
  try {
    return { key, text: await getPrompt(key, params), withCriteria: true };
  } catch {
    return { key: LEGACY_TURN_PROMPT_KEY, text: await getPrompt(LEGACY_TURN_PROMPT_KEY, params), withCriteria: false };
  }
}

function failedTurn(transcript: string): PracticeTurnResult {
  return {
    evaluation: { score: 0, feedback: 'Unable to evaluate. Please try again.', transcribed_text: transcript },
    ai_response: "I'm sorry, I couldn't process that. Could you try again?",
    criteria: null,
  };
}

/**
 * @param input - mode, history and the student turn as model parts
 * @returns evaluation, Bob reply and per-criterion bands 0-5; the intentional fallback is a zero-score turn without criteria
 */
export async function runPracticeTurn(input: PracticeTurnInput): Promise<PracticeTurnResult> {
  const fallback = failedTurn(input.fallbackTranscript);
  const prompt = await resolvePrompt(input.mode, input.topic, input.level);

  const result = await callGemini(
    { promptKey: prompt.key, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        ...input.history.map((msg) => ({ role: msg.role, parts: [{ text: msg.text }] })),
        { role: 'user', parts: [...input.studentParts, { text: prompt.text }] },
      ],
      config: { responseMimeType: 'application/json', responseSchema: responseSchema(prompt.withCriteria) },
    })
  );
  if (!result.ok || !result.data.text) return fallback;

  let parsed: unknown;
  try {
    parsed = parseModelJson(result.data.text);
  } catch {
    return fallback;
  }
  const validated = ChatTurnSchema.safeParse(parsed);
  if (!validated.success) return fallback;

  const rawCriteria = prompt.withCriteria
    ? (parsed as { evaluation?: { criteria?: unknown } }).evaluation?.criteria
    : null;
  const criteria = readTurnCriteria(rawCriteria);
  return {
    evaluation: input.hasAudio
      ? validated.data.evaluation
      : { ...validated.data.evaluation, transcribed_text: input.fallbackTranscript },
    ai_response: validated.data.ai_response,
    criteria: criteria && !input.hasAudio ? { ...criteria, pronunciation: null } : criteria,
  };
}
