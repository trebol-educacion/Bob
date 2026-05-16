'use server';

import { z } from 'zod';
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
import { callGemini, safeParseFallback } from '@/lib/gemini-client';

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

const ScenarioFallback: Part3Scenario = {
  topic: 'Organising a school trip',
  situation: 'You and a friend are planning a day trip for your class.',
  prompt_question: 'Which of these places would be best for your class trip?',
  options: ['the beach', 'a museum', 'a theme park', 'the countryside', 'a sports centre'],
};

const EvaluationFallback: CollaborativeEvaluation = {
  score: 0,
  task_achievement: 0,
  interaction: 0,
  grammar: 0,
  vocabulary: 0,
  feedback: 'Unable to evaluate at this time. Please try again.',
  strengths: [],
  areas_for_improvement: [],
};

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
  const cached = await getOrCreateCachedContent<Part3Scenario>(
    { kind: 'plan', promptKey: 'cambridge-pet-p3-b1-scenario', inputs: {} },
    async () => {
      const promptText = await getPrompt('cambridge_pet_p3_b1_generation');
      const result = await callGemini(
        { promptKey: 'cambridge_pet_p3_b1_generation', model: MODELS.FLASH_LITE_PREVIEW },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: { responseMimeType: 'application/json' },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generatePart3ScenarioAction', error: result.ok ? 'empty response' : result.error }));
        return ScenarioFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        return ScenarioFallback;
      }
      return safeParseFallback(Part3ScenarioSchema, parsed, ScenarioFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generatePart3ScenarioAction_cache', error: cached.error }));
    return ScenarioFallback;
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

  const result = await callGemini(
    { promptKey: 'cambridge_pet_p3_b1_partner_turn', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction },
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: 'application/json' },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'chatPart3Action', error: result.ok ? 'empty response' : result.error }));
    return { transcribed: '', examinerResponse: "Let's continue. What do you think?" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return { transcribed: '', examinerResponse: "Let's continue. What do you think?" };
  }

  const validated = safeParseFallback(
    Part3ChatResponseSchema,
    parsed,
    { transcribed: '', examiner_response: "Let's continue. What do you think?" }
  );

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({ sessionId, userId, role: 'user', msgType: 'text', contentText: validated.transcribed });
      await safePersist({ sessionId, userId, role: 'bob', msgType: 'text', contentText: validated.examiner_response });
    }
  }

  return {
    transcribed: validated.transcribed,
    examinerResponse: validated.examiner_response,
  };
}

/** Process a text turn, persist both user and Bob messages, and return the examiner reply. */
export async function chatPart3TextAction(
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<{ examinerResponse: string }> {
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

  const result = await callGemini(
    { promptKey: 'cambridge_pet_p3_b1_partner_turn_text', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
  );

  const examinerResponse = result.ok ? (result.data.text ?? '').trim() : "Let's continue. What do you think?";

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
  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n');
  const prompt = await getPrompt('cambridge_pet_p3_b1_evaluation', {
    SCENE_TOPIC: scenario.topic,
    SCENE_QUESTION: scenario.prompt_question,
    HISTORY_TEXT: historyText,
  });

  const result = await callGemini(
    { promptKey: 'cambridge_pet_p3_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePart3Action', error: result.ok ? 'empty response' : result.error }));
    return EvaluationFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return EvaluationFallback;
  }

  const evaluation = safeParseFallback(CollaborativeEvaluationSchema, parsed, EvaluationFallback);

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({
        sessionId,
        userId,
        role: 'bob',
        msgType: 'evaluation',
        contentJson: evaluation as unknown as Record<string, unknown>,
      });
    }
  }

  return evaluation;
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
