'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import {
  CollaborativeEvaluationSchema,
  type CollaborativeEvaluation,
  FormativeFeedbackSchema,
  type FormativeFeedback,
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

const FormativeFeedbackFallback: FormativeFeedback = {
  kind: 'formative',
  understood: false,
  highlights: [],
  suggestions: ['Try again — we could not process your response.'],
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
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
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
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
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

/** Evaluate the full B1 collaborative conversation and return formative feedback (no numeric score). */
export async function evaluatePart3Action(
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<FormativeFeedback> {
  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n');

  const prompt = `You are a supportive Cambridge B1 Preliminary examiner giving formative feedback.

Topic: "${scenario.topic}"
Task question: "${scenario.prompt_question}"

Candidate conversation:
${historyText}

Return ONLY a JSON object with these fields:
- "kind": always "formative"
- "understood": boolean — did the candidate communicate their ideas clearly?
- "highlights": array of 1-3 strings celebrating specific strengths (e.g. "Good use of linking words like 'however'", "Gave clear reasons for your choices")
- "suggestions": array of 1-3 specific improvement tips (e.g. "Try to use comparative adjectives when comparing options", "Remember to ask the examiner's opinion too")
- "model_answer": one example sentence demonstrating a strong way to express an opinion on this topic
- "rubric": an object with four integer scores 0-4 each: { "task_coverage": 0-4, "grammar": 0-4, "vocabulary": 0-4, "fluency": 0-4 }

Return ONLY valid JSON. No score, no band, no percentage outside the rubric object.`;

  const result = await callGemini(
    { promptKey: 'cambridge_pet_p3_b1_formative', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePart3Action', error: result.ok ? 'empty response' : result.error }));
    return FormativeFeedbackFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return FormativeFeedbackFallback;
  }

  const feedback = safeParseFallback(FormativeFeedbackSchema, parsed, FormativeFeedbackFallback);

  if (sessionId) {
    const userId = await resolveUserId();
    if (userId) {
      await safePersist({
        sessionId,
        userId,
        role: 'bob',
        msgType: 'evaluation',
        contentJson: { ...(feedback as unknown as Record<string, unknown>), is_final: true },
      });
    }
  }

  return feedback;
}

/** Read persisted messages for a B1 session and hydrate into Part3ChatMessage shape. */
export async function getB1SessionMessagesAction(
  sessionId: string
): Promise<{ history: Part3ChatMessage[]; feedback: FormativeFeedback | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { history: [], feedback: null };

  const rows = await readSessionMessages(sessionId, user.id);

  const history: Part3ChatMessage[] = [];
  let feedback: FormativeFeedback | null = null;

  for (const row of rows) {
    if (row.msg_type === 'evaluation' && row.role === 'bob' && row.content_json) {
      const parsed = FormativeFeedbackSchema.safeParse(row.content_json);
      if (parsed.success) feedback = parsed.data;
    } else if (row.msg_type === 'text') {
      history.push({
        role: row.role === 'user' ? 'user' : 'examiner',
        text: row.content_text ?? '',
      });
    }
  }

  return { history, feedback };
}
