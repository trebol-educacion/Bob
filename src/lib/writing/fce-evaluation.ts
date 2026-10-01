import type { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { MODELS } from '@/lib/models';

export interface FceEvaluationRequest<S extends z.ZodTypeAny> {
  promptKey: string;
  variables: Record<string, string>;
  userId: string;
  schema: S;
}

/**
 * @param request prompt key, variables and the schema the model output must satisfy
 * @returns the validated model output, or null when the prompt, the call or the parsing fails
 */
export async function requestFceEvaluation<S extends z.ZodTypeAny>(
  request: FceEvaluationRequest<S>,
): Promise<z.infer<S> | null> {
  let promptText: string;
  try {
    promptText = await getPrompt(request.promptKey, request.variables);
  } catch {
    return null;
  }

  const result = await callGemini(
    { promptKey: request.promptKey, model: MODELS.FLASH_LITE_PREVIEW, userId: request.userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
  );
  if (!isOk(result)) return null;

  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    return request.schema.parse(JSON.parse(rawText));
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'fce_writing_evaluation_parse_error',
        promptKey: request.promptKey,
        error: err instanceof Error ? err.message : String(err),
        rawPreview: rawText.slice(0, 300),
      }),
    );
    return null;
  }
}
