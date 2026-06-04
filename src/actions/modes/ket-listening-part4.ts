'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { MODELS } from '@/lib/models';

export type CharKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
const CHAR_KEYS: CharKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const PersonSchema = z.object({
  number: z.number().int().min(1).max(5),
  name: z.string(),
  monologue: z.string(),
  correct_key: z.enum(CHAR_KEYS),
});

const CharacteristicSchema = z.object({
  key: z.enum(CHAR_KEYS),
  text: z.string(),
});

const GenerationSchema = z.object({
  people: z.array(PersonSchema).length(5),
  characteristics: z.array(CharacteristicSchema).length(8),
});

export type Person = z.infer<typeof PersonSchema>;
export type Characteristic = z.infer<typeof CharacteristicSchema>;

export interface PersonWithAudio extends Person {
  audio_b64: string;
  audio_mime: string;
}

export interface ShortTalksExercise {
  people: PersonWithAudio[];
  characteristics: Characteristic[];
}

export interface ShortTalksResult {
  sessionId: string;
  userId: string;
  framing_text: string;
  exercise: ShortTalksExercise;
}

export interface PersonResult {
  number: number;
  name: string;
  chosen: CharKey | null;
  correct_key: CharKey;
  is_correct: boolean;
}

export interface ShortTalksSubmitResult {
  correct_count: number;
  total: number;
  person_results: PersonResult[];
  characteristics: Characteristic[];
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function generateKETShortTalksAction(input: {
  sessionId?: string;
}): Promise<ShortTalksResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_ket_listening_part4',
      title: 'KET Listening Part 4 — Short Talks',
    });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_listening_part4_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_listening_part4_a2_framing').catch(
      () =>
        'You will hear five people talking about themselves. Match each person to the correct description — A to H. There are three descriptions you do not need.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_listening_part4_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const audios = await Promise.all(
    parsed.people.map((p) =>
      generateSpeechAction(p.monologue).catch(() => ({
        data: '',
        mimeType: 'audio/L16;codec=pcm;rate=24000',
      }))
    )
  );

  const peopleWithAudio: PersonWithAudio[] = parsed.people.map((p, i) => ({
    ...p,
    audio_b64: audios[i]?.data ?? '',
    audio_mime: audios[i]?.mimeType ?? 'audio/L16;codec=pcm;rate=24000',
  }));

  const exercise: ShortTalksExercise = {
    people: peopleWithAudio,
    characteristics: parsed.characteristics,
  };

  persistMessage({
    sessionId: sessionId!,
    userId: userId!,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'short_talks_plan',
      framing_text: framingText,
      exercise: {
        people: parsed.people,
        characteristics: parsed.characteristics,
      },
    },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!,
    userId: userId!,
    framing_text: framingText,
    exercise,
  };
}

export async function submitKETShortTalksAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, CharKey | null>;
  exercise: { people: Person[]; characteristics: Characteristic[] };
}): Promise<ShortTalksSubmitResult | { error: string }> {
  const person_results: PersonResult[] = input.exercise.people.map((p) => {
    const chosen = input.answers[p.number] ?? null;
    return {
      number: p.number,
      name: p.name,
      chosen,
      correct_key: p.correct_key,
      is_correct: chosen === p.correct_key,
    };
  });

  const correct_count = person_results.filter((r) => r.is_correct).length;

  persistMessages(
    person_results.map((r) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: {
        kind: 'short_talks_answer',
        person_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      },
    }))
  ).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'short_talks_evaluation',
      score: correct_count,
      score_max: input.exercise.people.length,
      person_results,
      characteristics: input.exercise.characteristics,
      is_final: true,
    },
  }).catch(() => undefined);

  return {
    correct_count,
    total: input.exercise.people.length,
    person_results,
    characteristics: input.exercise.characteristics,
  };
}
