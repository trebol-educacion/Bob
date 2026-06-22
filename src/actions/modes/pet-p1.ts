'use server';

import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';

const PETInterviewPlanSchema = z.object({
  phase1_questions: z.array(z.string()).min(1),
  topicA: z.string(),
  topicA_questions: z.array(z.string()).min(1),
  topicA_followup: z.string(),
  topicBC: z.string(),
  topicBC_questions: z.array(z.string()).min(1),
  topicBC_followup: z.string(),
  closing: z.string(),
});

/** Interview plan for Cambridge B1 PET Speaking Part 1 (Interview). */
export type PETInterviewPlan = z.infer<typeof PETInterviewPlanSchema>;

const PETInterviewPlanFallback: PETInterviewPlan = {
  phase1_questions: ["Hello! What's your name?", 'Where are you from?'],
  topicA: 'Studies, Work and Ambitions',
  topicA_questions: ['Do you work or are you a student?', 'What job would you like to do in the future?'],
  topicA_followup: 'Can you tell me more about that?',
  topicBC: 'Daily Life',
  topicBC_questions: ['What do you usually do at weekends?', 'Tell me about a hobby you started recently.'],
  topicBC_followup: 'Why do you enjoy it?',
  closing: 'Thank you. That is the end of Part 1.',
};

const FormativeFeedbackFallback: FormativeFeedback = {
  kind: 'formative',
  understood: false,
  highlights: [],
  suggestions: ['Try again — we could not process your response.'],
};

/** Flattens a plan into the ordered list of questions the examiner asks. */
export function petInterviewQuestions(plan: PETInterviewPlan): string[] {
  return [
    ...plan.phase1_questions,
    ...plan.topicA_questions,
    plan.topicA_followup,
    ...plan.topicBC_questions,
    plan.topicBC_followup,
  ];
}

/** Generate a B1 PET Part 1 interview plan and persist it as a 'phrase' message. */
export async function generatePETInterviewAction(sessionId: string, userId: string): Promise<PETInterviewPlan> {
  const cached = await getOrCreateCachedContent<PETInterviewPlan>(
    { kind: 'plan', promptKey: 'cambridge-pet-p1-b1-plan', inputs: {} },
    async () => {
      const planPromptText = await getPrompt('cambridge_pet_p1_b1_generation');
      const result = await callGemini(
        { promptKey: 'cambridge_pet_p1_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: planPromptText }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generatePETInterviewAction', error: result.ok ? 'empty response' : result.error }));
        return PETInterviewPlanFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        console.error(JSON.stringify({ event: 'generatePETInterviewAction', error: 'invalid JSON' }));
        return PETInterviewPlanFallback;
      }
      return safeParseFallback(PETInterviewPlanSchema, parsed, PETInterviewPlanFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generatePETInterviewAction_cache', error: cached.error }));
    return PETInterviewPlanFallback;
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: cached as unknown as Record<string, unknown>,
  });
  if ('error' in persistResult) {
    console.error('[PET-p1 persist] plan:', persistResult.error);
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
export async function processPETInterviewAnswerAction(
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
    console.error('[PET-p1 persist] user_audio:', persistResult.error);
  }

  const reactionPromptText = await getPrompt('cambridge_pet_p1_b1_examiner_reaction', {
    USER_TRANSCRIPT: transcribed,
    LAST_QUESTION: question,
  });
  const reactionResult = await callGemini(
    { promptKey: 'cambridge_pet_p1_b1_examiner_reaction', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: reactionPromptText }] }],
    })
  );

  const reaction = cleanReaction(reactionResult.ok ? (reactionResult.data.text ?? '') : '');

  return { transcribed, reaction };
}

/** Evaluate the full B1 PET interview and return formative feedback (no numeric score). */
export async function evaluatePETInterviewAction(
  questionsAndAnswers: Array<{ question: string; answer: string }>,
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  const promptTemplate = await getPrompt('cambridge_pet_p1_b1_evaluation');
  const prompt = `${promptTemplate}\n\nTRANSCRIPT:\n${transcript}`;

  const result = await callGemini(
    { promptKey: 'cambridge_pet_p1_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePETInterviewAction', error: result.ok ? 'empty response' : result.error }));
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
    console.error('[PET-p1 persist] evaluation:', persistResult.error);
  }

  return feedback;
}

/** Read persisted messages for a PET p1 session and hydrate plan + QAs + formative feedback. */
export async function getPETInterviewMessagesAction(sessionId: string): Promise<{
  plan: PETInterviewPlan | null;
  qas: Array<{ question: string; answer: string }>;
  feedback: FormativeFeedback | null;
}> {
  const messages = await readSessionMessagesForCurrentOrUser(sessionId);

  let plan: PETInterviewPlan | null = null;
  const qas: Array<{ question: string; answer: string }> = [];
  let feedback: FormativeFeedback | null = null;

  for (const msg of messages) {
    if (msg.role === 'bob' && msg.msg_type === 'phrase' && plan === null) {
      const r = PETInterviewPlanSchema.safeParse(msg.content_json);
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
