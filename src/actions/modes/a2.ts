'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { CambridgeEvaluationSchema, type CambridgeEvaluation } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getOrCreateCachedContent } from '@/lib/cache';

const A2SessionPlanSchema = z.object({
  phase1_questions: z.array(z.string()).length(3),
  topic1: z.string(),
  topic1_questions: z.array(z.string()).length(4),
  topic2: z.string(),
  topic2_questions: z.array(z.string()).length(3),
  final_question: z.string(),
});

export type A2SessionPlan = z.infer<typeof A2SessionPlanSchema>;

/** Generate an A2 session plan and persist it as a 'phrase' message in bob_messages. */
export async function generateA2SessionAction(sessionId: string, userId: string): Promise<A2SessionPlan> {
  const ai = getAiClient();

  const cached = await getOrCreateCachedContent<A2SessionPlan>(
    { kind: 'plan', promptKey: 'cambridge-ket-part1-a2-plan', inputs: {} },
    async () => {
      const response = await ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: await getPrompt('cambridge_ket_part1_a2_generation') }] }],
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
      const result = A2SessionPlanSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`Invalid A2 session plan from AI: ${result.error.message}`);
      }
      return result.data;
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    throw new Error(cached.error);
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: cached as unknown as Record<string, unknown>,
  });
  if ('error' in persistResult) {
    console.error('[A2 persist] plan:', persistResult.error);
  }

  return cached;
}

/** Process a student audio answer and persist the transcription as a 'user_audio' message. */
export async function processA2AnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  const ai = getAiClient();

  const transcribeResponse = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: await getPrompt('cambridge_ket_part1_a2_transcribe'),
          },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });

  const transcribed = (transcribeResponse.text ?? '').trim();

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'user',
    msgType: 'user_audio',
    contentText: transcribed,
    contentJson: { question },
  });
  if ('error' in persistResult) {
    console.error('[A2 persist] user_audio:', persistResult.error);
  }

  const reactionResponse = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [{ text: await getPrompt('cambridge_ket_a2_rubric_helper', { QUESTION: question }) }],
      },
    ],
  });

  const reaction = (reactionResponse.text ?? '').trim();

  return { transcribed, reaction };
}

/** Evaluate the full A2 interview and persist the result as an 'evaluation' message. */
export async function evaluateA2FinalAction(
  questionsAndAnswers: Array<{ question: string; answer: string }>,
  sessionId: string,
  userId: string,
): Promise<CambridgeEvaluation> {
  const ai = getAiClient();

  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');
  const prompt = await getPrompt('cambridge_ket_part1_a2_evaluation', { QUESTION: 'Full interview', USER_TRANSCRIPT: transcript, AUDIO_DURATION_SECONDS: 0 });

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
  const result = CambridgeEvaluationSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid A2 evaluation from AI: ${result.error.message}`);
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: result.data as unknown as Record<string, unknown>,
  });
  if ('error' in persistResult) {
    console.error('[A2 persist] evaluation:', persistResult.error);
  }

  return result.data;
}

/** Read persisted messages for an A2 session and hydrate plan + QAs + evaluation. */
export async function getA2SessionMessagesAction(sessionId: string): Promise<{
  plan: A2SessionPlan | null;
  qas: Array<{ question: string; answer: string }>;
  evaluation: CambridgeEvaluation | null;
}> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { plan: null, qas: [], evaluation: null };

  const messages = await readSessionMessages(sessionId, user.id);

  let plan: A2SessionPlan | null = null;
  const qas: Array<{ question: string; answer: string }> = [];
  let evaluation: CambridgeEvaluation | null = null;

  for (const msg of messages) {
    if (msg.role === 'bob' && msg.msg_type === 'phrase' && plan === null) {
      const r = A2SessionPlanSchema.safeParse(msg.content_json);
      if (r.success) plan = r.data;
    } else if (msg.role === 'user' && msg.msg_type === 'user_audio') {
      const json = msg.content_json as { question?: string } | null;
      qas.push({ question: json?.question ?? '', answer: msg.content_text ?? '' });
    } else if (msg.role === 'bob' && msg.msg_type === 'evaluation') {
      const r = CambridgeEvaluationSchema.safeParse(msg.content_json);
      if (r.success) evaluation = r.data;
    }
  }

  return { plan, qas, evaluation };
}
