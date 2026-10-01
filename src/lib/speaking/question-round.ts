import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessagesForCurrentOrUser } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { toExaminerFeedback } from './examiner-score';
import type { SpeakingQA } from './types';

export interface QuestionRoundSchema<TPlan> {
  safeParse: (x: unknown) => { success: boolean; data?: TPlan; error?: unknown };
}

export interface QuestionRoundConfig<TPlan extends object> {
  promptPrefix: string;
  transcribePromptKey: string;
  planCacheKey: string;
  planSchema: QuestionRoundSchema<TPlan>;
  planFallback: TPlan;
  logTag: string;
  eventName: string;
  examinerReaction?: boolean;
  scoredEvaluation?: boolean;
}

const FormativeFeedbackFallback: FormativeFeedback = {
  kind: 'formative',
  understood: false,
  highlights: [],
  suggestions: ['Try again, we could not process your response.'],
};

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

function extractTranscript(raw: string): string {
  try {
    const obj = JSON.parse(raw) as { transcript?: unknown };
    return typeof obj.transcript === 'string' ? obj.transcript.trim() : raw;
  } catch {
    return raw;
  }
}

export async function generateQuestionRoundPlan<TPlan extends object>(
  config: QuestionRoundConfig<TPlan>,
  sessionId: string,
  userId: string,
  variables: Record<string, string> = {},
): Promise<TPlan> {
  const generationKey = `${config.promptPrefix}_generation`;
  const cached = await getOrCreateCachedContent<TPlan>(
    { kind: 'plan', promptKey: config.planCacheKey, inputs: variables },
    async () => {
      const planPromptText = await getPrompt(generationKey, variables);
      const result = await callGemini(
        { promptKey: generationKey, model: MODELS.FLASH_LITE_PREVIEW, userId },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: planPromptText }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: `generate${config.eventName}Action`, error: result.ok ? 'empty response' : result.error }));
        return config.planFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        console.error(JSON.stringify({ event: `generate${config.eventName}Action`, error: 'invalid JSON' }));
        return config.planFallback;
      }
      return safeParseFallback(config.planSchema, parsed, config.planFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: `generate${config.eventName}Action_cache`, error: cached.error }));
    return config.planFallback;
  }

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: cached as unknown as Record<string, unknown>,
  });
  if ('error' in persistResult) {
    console.error(`[${config.logTag} persist] plan:`, persistResult.error);
  }

  return cached;
}

export async function processQuestionRoundAnswer<TPlan extends object>(
  config: QuestionRoundConfig<TPlan>,
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  const transcribePromptText = await getPrompt(config.transcribePromptKey);
  const transcribeResult = await callGemini(
    { promptKey: config.transcribePromptKey, model: MODELS.FLASH_LITE_PREVIEW, userId },
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

  const transcribed =
    transcribeResult.ok && transcribeResult.data.text ? extractTranscript(transcribeResult.data.text.trim()) : '';

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'user',
    msgType: 'user_audio',
    contentText: transcribed,
    contentJson: { question },
  });
  if ('error' in persistResult) {
    console.error(`[${config.logTag} persist] user_audio:`, persistResult.error);
  }

  if (config.examinerReaction === false) return { transcribed, reaction: '' };

  const reactionKey = `${config.promptPrefix}_examiner_reaction`;
  const reactionPromptText = await getPrompt(reactionKey, {
    USER_TRANSCRIPT: transcribed,
    LAST_QUESTION: question,
  });
  const reactionResult = await callGemini(
    { promptKey: reactionKey, model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: reactionPromptText }] }],
    })
  );

  const reaction = cleanReaction(reactionResult.ok ? (reactionResult.data.text ?? '') : '');

  return { transcribed, reaction };
}

export async function evaluateQuestionRound<TPlan extends object>(
  config: QuestionRoundConfig<TPlan>,
  questionsAndAnswers: SpeakingQA[],
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  const evaluationKey = `${config.promptPrefix}_evaluation`;
  const promptTemplate = await getPrompt(evaluationKey);
  const prompt = `${promptTemplate}\n\nTRANSCRIPT:\n${transcript}`;

  const result = await callGemini(
    { promptKey: evaluationKey, model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: `evaluate${config.eventName}Action`, error: result.ok ? 'empty response' : result.error }));
    return FormativeFeedbackFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return FormativeFeedbackFallback;
  }

  const scored = config.scoredEvaluation ? toExaminerFeedback(parsed) : null;
  if (config.scoredEvaluation && !scored) return FormativeFeedbackFallback;
  const feedback = scored ?? safeParseFallback(FormativeFeedbackSchema, parsed, FormativeFeedbackFallback);

  const persistResult = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { ...(feedback as unknown as Record<string, unknown>), is_final: true },
  });
  if ('error' in persistResult) {
    console.error(`[${config.logTag} persist] evaluation:`, persistResult.error);
  }

  return feedback;
}

export async function readQuestionRoundMessages<TPlan extends object>(
  config: QuestionRoundConfig<TPlan>,
  sessionId: string,
): Promise<{ plan: TPlan | null; qas: SpeakingQA[]; feedback: FormativeFeedback | null }> {
  const messages = await readSessionMessagesForCurrentOrUser(sessionId);

  let plan: TPlan | null = null;
  const qas: SpeakingQA[] = [];
  let feedback: FormativeFeedback | null = null;

  for (const msg of messages) {
    if (msg.role === 'bob' && msg.msg_type === 'phrase' && plan === null) {
      const r = config.planSchema.safeParse(msg.content_json);
      if (r.success) plan = r.data as TPlan;
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
