'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { CambridgeEvaluationSchema, type CambridgeEvaluation } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';

const A2SessionPlanSchema = z.object({
  phase1_questions: z.array(z.string()).length(3),
  topic1: z.string(),
  topic1_questions: z.array(z.string()).length(4),
  topic2: z.string(),
  topic2_questions: z.array(z.string()).length(3),
  final_question: z.string(),
});

export type A2SessionPlan = z.infer<typeof A2SessionPlanSchema>;

const A2SessionPlanFallback: A2SessionPlan = {
  phase1_questions: ['What is your name?', 'How old are you?', 'Where do you live?'],
  topic1: 'School',
  topic1_questions: ['Do you like school?', 'What is your favourite subject?', 'Who is your best friend?', 'What do you do after school?'],
  topic2: 'Free time',
  topic2_questions: ['What do you do at the weekend?', 'Do you play any sports?', 'What is your favourite hobby?'],
  final_question: 'What do you want to do when you grow up?',
};

const CambridgeEvaluationFallback: CambridgeEvaluation = {
  score: 0,
  grammar: 0,
  vocabulary: 0,
  fluency: 0,
  feedback: 'Unable to evaluate at this time. Please try again.',
  strengths: [],
  areas_for_improvement: [],
};

/** Generate an A2 session plan and persist it as a 'phrase' message in bob_messages. */
export async function generateA2SessionAction(sessionId: string, userId: string): Promise<A2SessionPlan> {
  const cached = await getOrCreateCachedContent<A2SessionPlan>(
    { kind: 'plan', promptKey: 'cambridge-ket-part1-a2-plan', inputs: {} },
    async () => {
      const planPromptText = await getPrompt('cambridge_ket_part1_a2_generation');
      const result = await callGemini(
        { promptKey: 'cambridge_ket_part1_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: planPromptText }] }],
          config: { responseMimeType: 'application/json' },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generateA2SessionAction', error: result.ok ? 'empty response' : result.error }));
        return A2SessionPlanFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        console.error(JSON.stringify({ event: 'generateA2SessionAction', error: 'invalid JSON' }));
        return A2SessionPlanFallback;
      }
      return safeParseFallback(A2SessionPlanSchema, parsed, A2SessionPlanFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateA2SessionAction_cache', error: cached.error }));
    return A2SessionPlanFallback;
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
  const transcribePromptText = await getPrompt('cambridge_ket_part1_a2_transcribe');
  const transcribeResult = await callGemini(
    { promptKey: 'cambridge_ket_part1_a2_transcribe', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { text: transcribePromptText },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
    })
  );

  const transcribed = transcribeResult.ok ? (transcribeResult.data.text ?? '').trim() : '';

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

  const reactionPromptText = await getPrompt('cambridge_ket_a2_rubric_helper', { QUESTION: question });
  const reactionResult = await callGemini(
    { promptKey: 'cambridge_ket_a2_rubric_helper', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        { role: 'user', parts: [{ text: reactionPromptText }] },
      ],
    })
  );

  const reaction = reactionResult.ok ? (reactionResult.data.text ?? '').trim() : '';

  return { transcribed, reaction };
}

/** Evaluate the full A2 interview and persist the result as an 'evaluation' message. */
export async function evaluateA2FinalAction(
  questionsAndAnswers: Array<{ question: string; answer: string }>,
  sessionId: string,
  userId: string,
): Promise<CambridgeEvaluation> {
  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');
  const prompt = await getPrompt('cambridge_ket_part1_a2_evaluation', { QUESTION: 'Full interview', USER_TRANSCRIPT: transcript, AUDIO_DURATION_SECONDS: 0 });

  const result = await callGemini(
    { promptKey: 'cambridge_ket_part1_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateA2FinalAction', error: result.ok ? 'empty response' : result.error }));
    return CambridgeEvaluationFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return CambridgeEvaluationFallback;
  }

  const evaluation = safeParseFallback(CambridgeEvaluationSchema, parsed, CambridgeEvaluationFallback);

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: evaluation as unknown as Record<string, unknown>,
  });
  if ('error' in persistResult) {
    console.error('[A2 persist] evaluation:', persistResult.error);
  }

  return evaluation;
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
