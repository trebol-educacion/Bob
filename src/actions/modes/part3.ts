'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import {
  CollaborativeEvaluationSchema,
  type CollaborativeEvaluation,
} from '@/lib/types/practice';
import {
  buildPart3ScenarioPrompt,
  buildPart3ChatPrompt,
  buildPart3EvaluationPrompt,
} from '@/lib/prompts/part3';

export type Part3Scenario = {
  topic: string;
  situation: string;
  prompt_question: string;
  options: string[];
};

export type Part3ChatMessage = {
  role: 'user' | 'examiner';
  text: string;
};

const Part3ScenarioSchema = z.object({
  topic: z.string().min(1),
  situation: z.string().min(1),
  prompt_question: z.string().min(1),
  options: z.array(z.string()).length(5),
});

const Part3ChatResponseSchema = z.object({
  transcribed: z.string(),
  examiner_response: z.string(),
});

export async function generatePart3ScenarioAction(): Promise<Part3Scenario> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: buildPart3ScenarioPrompt() }] }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
  const result = Part3ScenarioSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid scenario from AI: ${result.error.message}`);
  }

  return result.data;
}

export async function chatPart3Action(
  audioBase64: string,
  mimeType: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario
): Promise<{ transcribed: string; examinerResponse: string }> {
  const ai = getAiClient();

  const systemInstruction = buildPart3ChatPrompt(scenario, history);

  const prompt = `Listen to the candidate's audio. First transcribe exactly what they said, then generate your next examiner response based on the conversation context.

Respond ONLY with valid JSON:
{
  "transcribed": "exact transcription of the candidate's speech",
  "examiner_response": "your next examiner line (under 30 words)"
}`;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemInstruction },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
  const result = Part3ChatResponseSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid chat response from AI: ${result.error.message}`);
  }

  return {
    transcribed: result.data.transcribed,
    examinerResponse: result.data.examiner_response,
  };
}

export async function chatPart3TextAction(
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario
): Promise<{ examinerResponse: string }> {
  const ai = getAiClient();

  const systemInstruction = buildPart3ChatPrompt(scenario, history);

  const prompt = `${systemInstruction}

The candidate just said: "${text}"

Respond with ONLY your next examiner line (no labels, no quotes, under 30 words).`;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const examinerResponse = (response.text ?? '').trim();

  return { examinerResponse };
}

export async function evaluatePart3Action(
  history: Part3ChatMessage[],
  scenario: Part3Scenario
): Promise<CollaborativeEvaluation> {
  const ai = getAiClient();

  const prompt = buildPart3EvaluationPrompt(scenario, history);

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
  const result = CollaborativeEvaluationSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid evaluation from AI: ${result.error.message}`);
  }

  return result.data;
}
