import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { currentUserId, finishSession, openSession, recordTurn, type TurnMessage } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { getOrCreateCachedContent } from '@/lib/cache';
import { parseJsonResult } from '@/lib/llm/parse-json-result';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { toExaminerFeedback } from './examiner-score';
import { SPEAKING_ANSWER_KIND } from './question-round-restore';
import type { QuestionRoundSchema } from './question-round-schema';
import type { QuestionRoundAnswer, QuestionRoundContext, QuestionRoundEvaluation, SpeakingQA } from './types';

export type { QuestionRoundSchema };

export interface QuestionRoundConfig<TPlan extends object> {
  mode: string;
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

      return parseJsonResult<TPlan>(result, config.planSchema, `generate${config.eventName}Action`);
    },
    { storeAs: 'json', validate: (plan) => config.planSchema.safeParse(plan).success }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: `generate${config.eventName}Action_cache`, error: cached.error }));
    return config.planFallback;
  }

  return cached;
}

function planOpening<TPlan extends object>(plan: TPlan): TurnMessage[] {
  return [{ role: 'bob', msgType: 'phrase', contentJson: plan as unknown as Record<string, unknown> }];
}

function answerMessage(question: string, answer: string): TurnMessage {
  return {
    role: 'user',
    msgType: 'text',
    contentText: answer,
    contentJson: { kind: SPEAKING_ANSWER_KIND, question },
  };
}

export async function processQuestionRoundAnswer<TPlan extends object>(
  config: QuestionRoundConfig<TPlan>,
  audioBase64: string,
  mimeType: string,
  question: string,
  context: QuestionRoundContext<TPlan>,
): Promise<ActionResult<QuestionRoundAnswer>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

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

  const session = await openSession({
    mode: config.mode,
    sessionId: context.sessionId,
    opening: planOpening(context.plan),
  });
  if (!session.ok) return session;
  const turn = await recordTurn({ ...session.data, messages: [answerMessage(question, transcribed)] });
  if (!turn.ok) return turn;

  const sessionId = session.data.sessionId;
  if (config.examinerReaction === false) return ok({ transcribed, reaction: '', sessionId });

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

  return ok({ transcribed, reaction, sessionId });
}

export async function evaluateQuestionRound<TPlan extends object>(
  config: QuestionRoundConfig<TPlan>,
  questionsAndAnswers: SpeakingQA[],
  context: QuestionRoundContext<TPlan>,
): Promise<ActionResult<QuestionRoundEvaluation>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const unscored = (): ActionResult<QuestionRoundEvaluation> =>
    ok({ feedback: FormativeFeedbackFallback, sessionId: context.sessionId });
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
    return unscored();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return unscored();
  }

  const scored = config.scoredEvaluation ? toExaminerFeedback(parsed) : null;
  if (config.scoredEvaluation && !scored) return unscored();
  const feedback = scored ?? safeParseFallback(FormativeFeedbackSchema, parsed, FormativeFeedbackFallback);

  const session = await openSession({
    mode: config.mode,
    sessionId: context.sessionId,
    opening: [
      ...planOpening(context.plan),
      ...questionsAndAnswers.map((qa) => answerMessage(qa.question, qa.answer)),
    ],
  });
  if (!session.ok) return session;

  const finished = await finishSession({
    ...session.data,
    evaluation: feedback as unknown as Record<string, unknown>,
  });
  if (!finished.ok) return finished;

  return ok({ feedback, sessionId: session.data.sessionId });
}
