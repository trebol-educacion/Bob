import { z } from 'zod';
import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { finishSession, openSession, recordTurn, type TurnMessage } from '@/lib/session/lifecycle';
import { fail, ok, type ActionResult } from '@/lib/result';
import { getOrCreateCachedContent } from '@/lib/cache';
import { parseJsonResult } from '@/lib/llm/parse-json-result';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { toExaminerFeedback } from './examiner-score';
import type { Part3ChatMessage, Part3Scenario } from './types';

export interface CollaborativeTemplateContext {
  scenario: Part3Scenario;
  history: Part3ChatMessage[];
  userTurn: string;
}

export interface CollaborativeConfig {
  mode: string;
  promptPrefix: string;
  scenarioCacheKey: string;
  scenarioFallback: Part3Scenario;
  examLabel: string;
  logTag: string;
  scenarioSchema?: { safeParse: (x: unknown) => { success: boolean; data?: Part3Scenario; error?: unknown } };
  templateVariables?: (context: CollaborativeTemplateContext) => Record<string, string>;
  scoredEvaluation?: boolean;
}

export const Part3ScenarioSchema = z.object({
  topic: z.string().min(1),
  situation: z.string().min(1),
  prompt_question: z.string().min(1),
  options: z.array(z.string()).length(5),
});

const Part3ChatResponseSchema = z.object({
  transcribed: z.string(),
  examiner_response: z.string(),
});

const FALLBACK_EXAMINER_LINE = "Let's continue. What do you think?";

const FormativeFeedbackFallback: FormativeFeedback = {
  kind: 'formative',
  understood: false,
  highlights: [],
  suggestions: ['Try again, we could not process your response.'],
};

function historyMessages(history: Part3ChatMessage[]): TurnMessage[] {
  return history.map((entry) => ({
    role: entry.role === 'user' ? 'user' : 'bob',
    msgType: 'text',
    contentText: entry.text,
  }));
}

async function recordCollaborativeTurn(
  config: CollaborativeConfig,
  scenario: Part3Scenario,
  history: Part3ChatMessage[],
  sessionId: string | undefined,
  turn: Part3ChatMessage[],
): Promise<ActionResult<{ sessionId: string }>> {
  const session = await openSession({
    mode: config.mode,
    sessionId,
    topic: scenario.topic,
    opening: [
      { role: 'bob', msgType: 'phrase', contentJson: scenario as unknown as Record<string, unknown> },
      ...historyMessages(history),
    ],
  });
  if (!session.ok) return session;
  const recorded = await recordTurn({ ...session.data, messages: historyMessages(turn) });
  if (!recorded.ok) return recorded;
  return ok({ sessionId: session.data.sessionId });
}

export function formatHistory(history: Part3ChatMessage[]): string {
  return history.map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`).join('\n');
}

function extractExaminerLine(raw: string): string {
  const stripped = raw.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  if (!stripped.startsWith('{')) return stripped;
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>;
    const line = [obj.partner_turn, obj.examiner_response, obj.examiner_prompt].find((v) => typeof v === 'string');
    return typeof line === 'string' ? line.trim() : '';
  } catch {
    return '';
  }
}

function partnerTurnPrompt(config: CollaborativeConfig, history: Part3ChatMessage[], scenario: Part3Scenario) {
  const variables = config.templateVariables?.({ scenario, history, userTurn: '' });
  return getPrompt(`${config.promptPrefix}_partner_turn`, variables ?? {
    SCENE_TOPIC: scenario.topic,
    SCENE_SITUATION: scenario.situation,
    SCENE_QUESTION: scenario.prompt_question,
    SCENE_OPTIONS: scenario.options.join(', '),
    HISTORY_TEXT: formatHistory(history) || '(just starting)',
  });
}

export async function generateCollaborativeScenario(config: CollaborativeConfig): Promise<Part3Scenario> {
  const generationKey = `${config.promptPrefix}_generation`;
  const scenarioSchema = config.scenarioSchema ?? Part3ScenarioSchema;
  const cached = await getOrCreateCachedContent<Part3Scenario>(
    { kind: 'plan', promptKey: config.scenarioCacheKey, inputs: {} },
    async () => {
      const promptText = await getPrompt(generationKey);
      const result = await callGemini(
        { promptKey: generationKey, model: MODELS.FLASH_LITE_PREVIEW },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_PREVIEW,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        })
      );

      return parseJsonResult<Part3Scenario>(result, scenarioSchema, 'generatePart3ScenarioAction');
    },
    { storeAs: 'json', validate: (scenario) => scenarioSchema.safeParse(scenario).success }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generatePart3ScenarioAction_cache', error: cached.error }));
    return config.scenarioFallback;
  }

  return cached;
}

export async function chatCollaborativeAudio(
  config: CollaborativeConfig,
  audioBase64: string,
  mimeType: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<ActionResult<{ transcribed: string; examinerResponse: string; sessionId: string }>> {
  const systemInstruction = await partnerTurnPrompt(config, history, scenario);
  const audioVariables = config.templateVariables?.({
    scenario,
    history,
    userTurn: 'the attached audio recording',
  });
  const prompt = await getPrompt(`${config.promptPrefix}_partner_turn_audio`, audioVariables);

  const result = await callGemini(
    { promptKey: `${config.promptPrefix}_partner_turn`, model: MODELS.FLASH_LITE_PREVIEW },
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
    return fail('chat_failed', true);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fail('chat_failed', true);
  }

  const validated = safeParseFallback(
    Part3ChatResponseSchema,
    parsed,
    { transcribed: '', examiner_response: FALLBACK_EXAMINER_LINE }
  );

  const recorded = await recordCollaborativeTurn(config, scenario, history, sessionId, [
    { role: 'user', text: validated.transcribed },
    { role: 'examiner', text: validated.examiner_response },
  ]);
  if (!recorded.ok) return recorded;

  return ok({
    transcribed: validated.transcribed,
    examinerResponse: validated.examiner_response,
    sessionId: recorded.data.sessionId,
  });
}

export async function chatCollaborativeText(
  config: CollaborativeConfig,
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<ActionResult<{ examinerResponse: string; sessionId: string }>> {
  const systemInstruction = await partnerTurnPrompt(config, history, scenario);

  const prompt = `${systemInstruction}

The candidate just said: "${text}"

Respond with ONLY your next examiner line (no labels, no quotes, under 30 words).`;

  const result = await callGemini(
    { promptKey: `${config.promptPrefix}_partner_turn_text`, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
  );

  const extracted = result.ok ? extractExaminerLine(result.data.text ?? '') : '';
  const examinerResponse = extracted || FALLBACK_EXAMINER_LINE;

  const recorded = await recordCollaborativeTurn(config, scenario, history, sessionId, [
    { role: 'user', text },
    { role: 'examiner', text: examinerResponse },
  ]);
  if (!recorded.ok) return recorded;

  return ok({ examinerResponse, sessionId: recorded.data.sessionId });
}

function inlineEvaluationPrompt(
  config: CollaborativeConfig,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
): string {
  return `You are a supportive ${config.examLabel} examiner giving formative feedback.

Topic: "${scenario.topic}"
Task question: "${scenario.prompt_question}"

Candidate conversation:
${formatHistory(history)}

Return ONLY a JSON object with these fields:
- "kind": always "formative"
- "understood": boolean, did the candidate communicate their ideas clearly?
- "highlights": array of 1-3 strings celebrating specific strengths (e.g. "Good use of linking words like 'however'", "Gave clear reasons for your choices")
- "suggestions": array of 1-3 specific improvement tips (e.g. "Try to use comparative adjectives when comparing options", "Remember to ask the examiner's opinion too")
- "model_answer": one example sentence demonstrating a strong way to express an opinion on this topic
- "rubric": an object with four integer scores 0-4 each: { "task_coverage": 0-4, "grammar": 0-4, "vocabulary": 0-4, "fluency": 0-4 }

Return ONLY valid JSON. No score, no band, no percentage outside the rubric object.`;
}

async function buildEvaluationPrompt(
  config: CollaborativeConfig,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
): Promise<string> {
  if (!config.scoredEvaluation) return inlineEvaluationPrompt(config, history, scenario);
  const variables = config.templateVariables?.({ scenario, history, userTurn: '' });
  const template = await getPrompt(`${config.promptPrefix}_evaluation`, variables);
  return `${template}\n\nTRANSCRIPT:\n${formatHistory(history)}`;
}

export async function evaluateCollaborative(
  config: CollaborativeConfig,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<ActionResult<{ feedback: FormativeFeedback; sessionId?: string }>> {
  const prompt = await buildEvaluationPrompt(config, history, scenario);

  const result = await callGemini(
    { promptKey: `${config.promptPrefix}_formative`, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePart3Action', error: result.ok ? 'empty response' : result.error }));
    return ok({ feedback: FormativeFeedbackFallback, sessionId });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return ok({ feedback: FormativeFeedbackFallback, sessionId });
  }

  const scored = config.scoredEvaluation ? toExaminerFeedback(parsed) : null;
  if (config.scoredEvaluation && !scored) return ok({ feedback: FormativeFeedbackFallback, sessionId });
  const feedback = scored ?? safeParseFallback(FormativeFeedbackSchema, parsed, FormativeFeedbackFallback);

  const session = await openSession({
    mode: config.mode,
    sessionId,
    topic: scenario.topic,
    opening: [
      { role: 'bob', msgType: 'phrase', contentJson: scenario as unknown as Record<string, unknown> },
      ...historyMessages(history),
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
