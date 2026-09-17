'use server';

import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { PhraseGenerationSchema } from '@/lib/types/gemini';
import { pickVocabulary, wordsToPromptVars, type CefrLevel } from '@/lib/vocabulary';

/**
 * Generates 10 progressive phrases based on a user-provided topic and CEFR level.
 * For B1/B2, 10 official Cambridge words are pre-picked from `bob_vocabulary`
 * and injected as `{WORD_1..10}` to kill few-shot anchoring and guarantee
 * variety across sessions (see .sdd/sessions/2026-05-17-starters-pointing-rework.md §3).
 */
export async function generateTopicPhrasesAction(
  topic: string,
  level: CefrLevel = 'a2',
): Promise<string[]> {
  const promptKey = `generic_situation_${level}_generation`;

  const promptVars: Record<string, string> = { TOPIC: topic };
  if (level === 'b1' || level === 'b2') {
    const picked = await pickVocabulary({ cefr_level: level, count: 10 });
    Object.assign(promptVars, wordsToPromptVars(picked.map((p) => p.word)));
  }
  const prompt = await getPrompt(promptKey, promptVars);

  const result = await callGemini(
    { promptKey, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              minItems: 10,
              maxItems: 10,
              description: 'Exactly 10 English phrases ordered easier → harder. Each phrase MUST contain the assigned WORD_N.',
            },
          },
          required: ['phrases'],
        },
      },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: result.ok ? 'empty response' : result.error }));
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: 'invalid JSON' }));
    return [];
  }
  const outcome = PhraseGenerationSchema.safeParse(parsed);
  if (!outcome.success) {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: 'schema validation failed', issues: outcome.error.issues }));
    return [];
  }
  if (outcome.data.phrases.length < 10) {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: 'fewer than 10 phrases', count: outcome.data.phrases.length }));
  }
  return outcome.data.phrases.slice(0, 10);
}

