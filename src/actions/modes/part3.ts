'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import {
  CollaborativeEvaluationSchema,
  type CollaborativeEvaluation,
} from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';
import type { PersistMessageInput } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';

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

async function resolveUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function safePersist(input: PersistMessageInput): Promise<void> {
  const result = await persistMessage(input);
  if ('error' in result) {
    console.error('[B1 persist] persistMessage failed:', result.error);
  }
}

/** Generate a new B1 Collaborative scenario and persist it as setup. */
export async function generatePart3ScenarioAction(sessionId?: string): Promise<Part3Scenario> {
  const ai = getAiClient();

  const cached = await getOrCreateCachedContent<Part3Scenario>(
    { kind: 'plan', promptKey: 'cambridge-pet-p3-b1-scenario', inputs: {} },
    async () => {
      const response = await ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: await getPrompt('cambridge_pet_p3_b1_generation') }] }],
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
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    throw new Error(cached.error);
  }

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({
        sessionId,
        userId,
        role: 'bob',
        msgType: 'phrase',
        contentJson: cached as unknown as Record<string, unknown>,
      });
    }
  }

  return cached;
}

/** Process an audio turn, persist both user and Bob messages, and return transcription + examiner reply. */
export async function chatPart3Action(
  audioBase64: string,
  mimeType: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<{ transcribed: string; examinerResponse: string }> {
  const ai = getAiClient();

  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n') || '(just starting)';
  const systemInstruction = await getPrompt('cambridge_pet_p3_b1_partner_turn', {
    SCENE_TOPIC: scenario.topic,
    SCENE_SITUATION: scenario.situation,
    SCENE_QUESTION: scenario.prompt_question,
    SCENE_OPTIONS: scenario.options.join(', '),
    HISTORY_TEXT: historyText,
  });

  const prompt = await getPrompt('cambridge_pet_p3_b1_partner_turn_audio');

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

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({ sessionId, userId, role: 'user', msgType: 'text', contentText: result.data.transcribed });
      await safePersist({ sessionId, userId, role: 'bob', msgType: 'text', contentText: result.data.examiner_response });
    }
  }

  return {
    transcribed: result.data.transcribed,
    examinerResponse: result.data.examiner_response,
  };
}

/** Process a text turn, persist both user and Bob messages, and return the examiner reply. */
export async function chatPart3TextAction(
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<{ examinerResponse: string }> {
  const ai = getAiClient();

  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n') || '(just starting)';
  const systemInstruction = await getPrompt('cambridge_pet_p3_b1_partner_turn', {
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

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({ sessionId, userId, role: 'user', msgType: 'text', contentText: text });
      await safePersist({ sessionId, userId, role: 'bob', msgType: 'text', contentText: examinerResponse });
    }
  }

  return { examinerResponse };
}

/** Evaluate the full conversation and persist the result as an evaluation message. */
export async function evaluatePart3Action(
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<CollaborativeEvaluation> {
  const ai = getAiClient();

  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n');
  const prompt = await getPrompt('cambridge_pet_p3_b1_evaluation', {
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

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({
        sessionId,
        userId,
        role: 'bob',
        msgType: 'evaluation',
        contentJson: result.data as unknown as Record<string, unknown>,
      });
    }
  }

  return result.data;
}

/** Read persisted messages for a B1 session and hydrate into Part3ChatMessage shape. */
export async function getB1SessionMessagesAction(
  sessionId: string
): Promise<{ history: Part3ChatMessage[]; evaluation: CollaborativeEvaluation | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { history: [], evaluation: null };

  const rows = await readSessionMessages(sessionId, user.id);

  const history: Part3ChatMessage[] = [];
  let evaluation: CollaborativeEvaluation | null = null;

  for (const row of rows) {
    if (row.msg_type === 'evaluation' && row.role === 'bob' && row.content_json) {
      const parsed = CollaborativeEvaluationSchema.safeParse(row.content_json);
      if (parsed.success) evaluation = parsed.data;
    } else if (row.msg_type === 'text') {
      history.push({
        role: row.role === 'user' ? 'user' : 'examiner',
        text: row.content_text ?? '',
      });
    }
  }

  return { history, evaluation };
}
