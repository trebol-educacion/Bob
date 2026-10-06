'use server';

import { MODELS } from '@/lib/models';
import { RepetitionObjectiveFeedbackSchema, type RepetitionObjectiveFeedback } from '@/lib/types/practice';
import { REPEAT_ANSWER_KIND, buildRepeatEvaluation, restoreRepeat, type ToeflRepeatItem } from '@/lib/toefl/repeat';
import { currentUserId, finishSession, openSession, recordTurn } from '@/lib/session/lifecycle';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { ToeflRepeatPlanSchema } from '@/lib/bank-plans/toefl-repeat';
import { readSessionMessages } from '@/lib/persist-activity';
import { fail, ok, type ActionResult } from '@/lib/result';
import { callGemini } from '@/lib/gemini-client';

const REPEAT_LEVEL = 'b1';
const REPEAT_PART = 'toefl_listen_repeat';

export interface ToeflRepeatSession {
  items: ToeflRepeatItem[];
  bankGroupId: string;
}

/** Reads one pregenerated Listen & Repeat set with its audio URLs from the bank; no model call and no session row. */
export async function generateToeflRepeatSessionAction(): Promise<ActionResult<ToeflRepeatSession>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: REPEAT_LEVEL,
    examPart: REPEAT_PART,
    skill: 'speaking',
    schema: ToeflRepeatPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok({ items: picked.data.plan.items, bankGroupId: picked.data.groupId });
}

const MODE = 'toefl_listen_repeat';

export interface RepetitionInput {
  items: ToeflRepeatItem[];
  bankGroupId?: string;
  phraseIndex: number;
  audioBase64: string;
  mimeType: string;
  sessionId?: string;
}

export interface RepetitionOutcome {
  sessionId: string;
  feedback: RepetitionObjectiveFeedback;
}

async function evaluateRepetition(originalText: string, audioBase64: string, mimeType: string): Promise<RepetitionObjectiveFeedback | null> {
  const prompt = `You are evaluating a Listen & Repeat exercise.

Target sentence: "${originalText}"

Listen to the audio and transcribe what the student said. Then compare word by word.

Return ONLY a JSON object with these fields:
- "kind": always "repetition_objective"
- "exact_repetition": boolean, true only if every word matches exactly (case-insensitive)
- "missing_words": array of words from the target sentence that were omitted
- "extra_words": array of words the student said that are not in the target sentence
- "transcribed_text": what the student actually said (verbatim transcription)
- "original_text": "${originalText}"

Return ONLY valid JSON. No score, no pronunciation rating, no subjective assessment.`;

  const userId = (await currentUserId()) ?? undefined;
  const result = await callGemini(
    { promptKey: 'toefl_listen_repeat_b1_objective', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );
  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateRepetition', error: result.ok ? 'empty response' : result.error }));
    return null;
  }
  try {
    const parsed = RepetitionObjectiveFeedbackSchema.safeParse(JSON.parse(result.data.text));
    return parsed.success ? { ...parsed.data, original_text: originalText } : null;
  } catch {
    return null;
  }
}

/** Evaluates a repetition objectively; opens the session on the first graded attempt and persists the turn. */
export async function submitRepetitionAction(input: RepetitionInput): Promise<RepetitionOutcome | { error: string }> {
  const item = input.items[input.phraseIndex];
  if (!item) return { error: 'invalid_item' };
  const feedback = await evaluateRepetition(item.text, input.audioBase64, input.mimeType);
  if (!feedback) return { error: 'evaluation_failed' };

  const opened = await openSession({
    mode: MODE,
    sessionId: input.sessionId,
    opening: [{ role: 'bob', msgType: 'phrase', contentJson: { phrases: input.items, ...bankStamp(REPEAT_PART, input.bankGroupId) } }],
  });
  if (!opened.ok) return { error: opened.code };

  const turn = await recordTurn({
    ...opened.data,
    messages: [
      {
        role: 'user',
        msgType: 'text',
        contentText: feedback.transcribed_text || null,
        contentJson: { kind: REPEAT_ANSWER_KIND, phraseIndex: input.phraseIndex, exact_repetition: feedback.exact_repetition },
      },
      { role: 'bob', msgType: 'evaluation', contentJson: { phraseIndex: input.phraseIndex, ...feedback } },
    ],
  });
  if (!turn.ok) return { error: turn.code };
  return { sessionId: opened.data.sessionId, feedback };
}

/** Closes the session with the 0-10 grade from exact repetitions over the item count. */
export async function finishToeflRepeatAction(sessionId: string): Promise<{ score10: number | null } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const restored = restoreRepeat(await readSessionMessages(sessionId, userId));
  if (!restored) return { error: 'nothing_to_grade' };
  const finished = await finishSession({
    sessionId,
    userId,
    evaluation: buildRepeatEvaluation(restored.evaluations, restored.items.length),
  });
  return finished.ok ? { score10: finished.data.score10 } : { error: finished.code };
}
