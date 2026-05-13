'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import {
  CollaborativeEvaluationSchema,
  type CollaborativeEvaluation,
} from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';

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
    contents: [{ role: 'user', parts: [{ text: await getPrompt('b1_part3_scenario') }] }],
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

  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n') || '(just starting)';
  const systemInstruction = await getPrompt('b1_part3_chat', {
    SCENE_TOPIC: scenario.topic,
    SCENE_SITUATION: scenario.situation,
    SCENE_QUESTION: scenario.prompt_question,
    SCENE_OPTIONS: scenario.options.join(', '),
    HISTORY_TEXT: historyText,
  });

  const prompt = await getPrompt('b1_part3_chat_audio');

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

  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n') || '(just starting)';
  const systemInstruction = await getPrompt('b1_part3_chat', {
    SCENE_TOPIC: scenario.topic,
    SCENE_SITUATION: scenario.situation,
    SCENE_QUESTION: scenario.prompt_question,
    SCENE_OPTIONS: scenario.options.join(', '),
    HISTORY_TEXT: historyText,
  });

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

  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n');
  const prompt = await getPrompt('b1_part3_eval', {
    SCENE_TOPIC: scenario.topic,
    SCENE_QUESTION: scenario.prompt_question,
    HISTORY_TEXT: historyText,
  });

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
