'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';

const PETDiscussionPlanSchema = z.object({
  topic: z.string(),
  link: z.string(),
  questions: z.array(z.string()).min(1),
  closing: z.string(),
});

/** Discussion plan for Cambridge B1 PET Speaking Part 4 (Discussion / Follow-up). */
export type PETDiscussionPlan = z.infer<typeof PETDiscussionPlanSchema>;

const PETDiscussionPlanFallback: PETDiscussionPlan = {
  topic: 'Free time and hobbies',
  link: "We've been talking about hobbies. Now I'd like you to discuss something more general.",
  questions: [
    'Do you think hobbies are important? Why?',
    'Is it better to have a hobby alone or with friends? Why?',
    'Tell me about a hobby you enjoyed when you were younger.',
    'Do you prefer indoor or outdoor activities? Why?',
    'Some people say young people spend too much time on screens. Do you agree? Why or why not?',
    'What new hobby would you like to try in the future, and why?',
  ],
  closing: 'Thank you. That is the end of the Speaking Test.',
};

const FormativeFeedbackFallback: FormativeFeedback = {
  kind: 'formative',
  understood: false,
  highlights: [],
  suggestions: ['Try again — we could not process your response.'],
};

/** Flattens a plan into the ordered list of questions the examiner asks. */
export function petDiscussionQuestions(plan: PETDiscussionPlan): string[] {
  return [...plan.questions];
}

/** Generate a B1 PET Part 4 discussion plan and persist it as a 'phrase' message. */
export async function generatePETDiscussionAction(sessionId: string, userId: string): Promise<PETDiscussionPlan> {
  const cached = await getOrCreateCachedContent<PETDiscussionPlan>(
    { kind: 'plan', promptKey: 'cambridge-pet-p4-b1-plan', inputs: {} },
    async () => {
      const planPromptText = await getPrompt('cambridge_pet_p4_b1_generation');
      const result = await callGemini(
        { promptKey: 'cambridge_pet_p4_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: planPromptText }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generatePETDiscussionAction', error: result.ok ? 'empty response' : result.error }));
        return PETDiscussionPlanFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        console.error(JSON.stringify({ event: 'generatePETDiscussionAction', error: 'invalid JSON' }));
        return PETDiscussionPlanFallback;
      }
      return safeParseFallback(PETDiscussionPlanSchema, parsed, PETDiscussionPlanFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generatePETDiscussionAction_cache', error: cached.error }));
    return PETDiscussionPlanFallback;
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: cached as unknown as Record<string, unknown>,
  });
  if ('error' in persistResult) {
    console.error('[PET-p4 persist] plan:', persistResult.error);
  }

  return cached;
}

/** Strips JSON/code an LLM reaction may emit, returning a clean line or empty string. */
function cleanReaction(raw: string): string {
  const stripped = raw.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  if (!stripped) return '';
  if (stripped.startsWith('[')) return '';
  if (stripped.startsWith('{')) {
    try {
      const obj = JSON.parse(stripped) as { reaction?: unknown };
      return typeof obj.reaction === 'string' ? obj.reaction.trim() : '';
    } catch {
      return '';
    }
  }
  return stripped;
}

/** Transcribe a student audio answer, persist it, and return transcription + examiner reaction. */
export async function processPETDiscussionAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  const transcribePromptText = await getPrompt('cambridge_pet_p4_b1_transcribe');
  const transcribeResult = await callGemini(
    { promptKey: 'cambridge_pet_p4_b1_transcribe', model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  let transcribed = '';
  if (transcribeResult.ok && transcribeResult.data.text) {
    const raw = transcribeResult.data.text.trim();
    try {
      const obj = JSON.parse(raw) as { transcript?: unknown };
      transcribed = typeof obj.transcript === 'string' ? obj.transcript.trim() : raw;
    } catch {
      transcribed = raw;
    }
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'user',
    msgType: 'user_audio',
    contentText: transcribed,
    contentJson: { question },
  });
  if ('error' in persistResult) {
    console.error('[PET-p4 persist] user_audio:', persistResult.error);
  }

  const reactionPromptText = await getPrompt('cambridge_pet_p4_b1_examiner_reaction', {
    USER_TRANSCRIPT: transcribed,
    LAST_QUESTION: question,
  });
  const reactionResult = await callGemini(
    { promptKey: 'cambridge_pet_p4_b1_examiner_reaction', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: reactionPromptText }] }],
    })
  );

  const reaction = cleanReaction(reactionResult.ok ? (reactionResult.data.text ?? '') : '');

  return { transcribed, reaction };
}

/** Evaluate the full B1 PET discussion and return formative feedback (no numeric score). */
export async function evaluatePETDiscussionAction(
  questionsAndAnswers: Array<{ question: string; answer: string }>,
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  const promptTemplate = await getPrompt('cambridge_pet_p4_b1_evaluation');
  const prompt = `${promptTemplate}\n\nTRANSCRIPT:\n${transcript}`;

  const result = await callGemini(
    { promptKey: 'cambridge_pet_p4_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePETDiscussionAction', error: result.ok ? 'empty response' : result.error }));
    return FormativeFeedbackFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return FormativeFeedbackFallback;
  }

  const feedback = safeParseFallback(FormativeFeedbackSchema, parsed, FormativeFeedbackFallback);

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { ...(feedback as unknown as Record<string, unknown>), is_final: true },
  });
  if ('error' in persistResult) {
    console.error('[PET-p4 persist] evaluation:', persistResult.error);
  }

  return feedback;
}

/** Read persisted messages for a PET p4 session and hydrate plan + QAs + formative feedback. */
export async function getPETDiscussionMessagesAction(sessionId: string): Promise<{
  plan: PETDiscussionPlan | null;
  qas: Array<{ question: string; answer: string }>;
  feedback: FormativeFeedback | null;
}> {
  const messages = await readSessionMessagesForCurrentOrUser(sessionId);

  let plan: PETDiscussionPlan | null = null;
  const qas: Array<{ question: string; answer: string }> = [];
  let feedback: FormativeFeedback | null = null;

  for (const msg of messages) {
    if (msg.role === 'bob' && msg.msg_type === 'phrase' && plan === null) {
      const r = PETDiscussionPlanSchema.safeParse(msg.content_json);
      if (r.success) plan = r.data;
    } else if (msg.role === 'user' && msg.msg_type === 'user_audio') {
      const json = msg.content_json as { question?: string } | null;
      qas.push({ question: json?.question ?? '', answer: msg.content_text ?? '' });
    } else if (msg.role === 'bob' && msg.msg_type === 'evaluation') {
      const r = FormativeFeedbackSchema.safeParse(msg.content_json);
      if (r.success) feedback = r.data;
    }
  }

  return { plan, qas, feedback };
}
