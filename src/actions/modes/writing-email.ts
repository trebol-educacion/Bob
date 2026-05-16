'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { MODELS } from '@/lib/models';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

interface EvaluateEmailInput {
  text: string;
  sessionId: string;
  userId: string;
  framework: string;
  exam_part: string;
  targetWordCount: [number, number];
  bullets?: string[];
}

const GeminiEmailFeedbackSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().optional(),
  covered_bullets: z.array(z.string()).optional(),
  missing_bullets: z.array(z.string()).optional(),
});

function buildFallback(wordCount: number, targetWordCount: [number, number]): WritingFormativeFeedback {
  return {
    kind: 'writing_formative',
    understood: false,
    highlights: [],
    suggestions: [],
    indicators: { word_count: wordCount, target_word_count_range: targetWordCount },
  };
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

/** Evaluates an email writing task using Gemini and returns formative feedback (no numeric score). */
export async function evaluateEmailAction(
  input: EvaluateEmailInput
): Promise<WritingFormativeFeedback | { error: string }> {
  const wordCount = countWords(input.text);
  const fallback = buildFallback(wordCount, input.targetWordCount);

  let evalPromptText: string;
  try {
    evalPromptText = await getPrompt(input.exam_part);
  } catch {
    try {
      evalPromptText = await getPrompt(`${input.exam_part}_evaluation`);
    } catch {
      persistMessage({
        sessionId: input.sessionId,
        userId: input.userId,
        role: 'bob',
        msgType: 'evaluation',
        contentJson: fallback as unknown as Record<string, unknown>,
      }).catch(() => undefined);
      return fallback;
    }
  }

  const systemInstruction = `You are a Cambridge/TOEFL writing examiner providing FORMATIVE feedback only.
Never assign a numeric score. Return JSON with: understood (boolean), highlights (array of 2-3 strengths),
suggestions (array of 2-3 improvement points), model_answer (optional short example),
covered_bullets (optional array of task points addressed), missing_bullets (optional array of task points missed).`;

  const userContent = `Exam part prompt:\n${evalPromptText}\n\nStudent answer (${wordCount} words):\n${input.text}`;

  const result = await callGemini(
    { promptKey: input.exam_part, model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      })
  );

  if (!isOk(result)) {
    persistMessage({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: fallback as unknown as Record<string, unknown>,
    }).catch(() => undefined);
    return fallback;
  }

  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  let parsed: z.infer<typeof GeminiEmailFeedbackSchema>;
  try {
    parsed = GeminiEmailFeedbackSchema.parse(JSON.parse(rawText));
  } catch {
    persistMessage({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'bob',
      msgType: 'evaluation',
      contentJson: fallback as unknown as Record<string, unknown>,
    }).catch(() => undefined);
    return fallback;
  }

  const feedback: WritingFormativeFeedback = {
    kind: 'writing_formative',
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer,
    indicators: {
      word_count: wordCount,
      target_word_count_range: input.targetWordCount,
      covered_bullets: parsed.covered_bullets,
      missing_bullets: parsed.missing_bullets,
    },
  };

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: feedback as unknown as Record<string, unknown>,
  }).catch(() => undefined);

  return feedback;
}
