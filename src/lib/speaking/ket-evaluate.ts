import { callGemini, isOk } from '@/lib/gemini-client';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { MODELS } from '@/lib/models';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetSpeakingFeedbackSchema, normalizeKetFeedback, type KetSpeakingFeedback } from './ket-speaking';

/**
 * @param input.promptKey evaluation prompt key in bob.prompts
 * @param input.replacements placeholders replaced in the prompt template
 * @param input.audioBase64 recorded answer
 * @param input.audioMime mime type of the recording
 * @param input.userId authenticated user
 * @returns structured feedback, or a retryable failure so the session is never closed without a grade
 */
export async function evaluateKetAudio(input: {
  promptKey: string;
  replacements: Record<string, string>;
  audioBase64: string;
  audioMime: string;
  userId: string;
}): Promise<ActionResult<KetSpeakingFeedback>> {
  const template = await getPrompt(input.promptKey).catch(() => null);
  if (!template) return fail('prompt_unavailable', true);

  const prompt = Object.entries(input.replacements).reduce(
    (text, [placeholder, value]) => text.replace(placeholder, value),
    template,
  );

  const result = await callGemini(
    { promptKey: input.promptKey, model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }, { inlineData: { mimeType: input.audioMime, data: input.audioBase64 } }],
      }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  );
  if (!isOk(result)) return fail('evaluation_failed', true);

  const raw = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    const parsed = KetSpeakingFeedbackSchema.safeParse(JSON.parse(raw));
    return parsed.success ? ok(normalizeKetFeedback(parsed.data)) : fail('evaluation_invalid', true);
  } catch {
    return fail('evaluation_invalid', true);
  }
}
