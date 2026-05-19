'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { mapListeningScoreToCefr } from '@/lib/assessment/cefr-mapping';
import type { Skill } from '@/lib/types/skills';
import type { AssessmentCefrBand, AssessmentConfidence, AssessmentResultSpeaking, AssessmentResultListening, AssessmentResultReading, AssessmentResultWriting, AssessmentWritingFeedback } from '@/lib/types/skills';

export interface AssessmentPrompt {
  turn_number: number;
  prompt_text: string;
}

export interface AssessmentListeningItem {
  id: string;
  audio_url: string;
  transcript: string | null;
  question: string;
  options: Array<{ key: string; label: string }>;
}

export interface AssessmentReadingItem {
  id: string;
  stimulus_text: string;
  question: string;
  options: Array<{ key: string; label: string }>;
}

export interface AssessmentWritingTask {
  prompt_text: string;
  bullet_count: number;
}

export type StartAssessmentResult =
  | { status: 'ok'; skill: 'speaking'; assessment_id: string; prompts: AssessmentPrompt[]; is_yl: boolean }
  | { status: 'ok'; skill: 'listening'; assessment_id: string; items: AssessmentListeningItem[] }
  | { status: 'ok'; skill: 'reading'; assessment_id: string; items: AssessmentReadingItem[] }
  | { status: 'ok'; skill: 'writing'; assessment_id: string; task: AssessmentWritingTask }
  | { status: 'cooldown'; days_remaining: number; available_at: string }
  | { status: 'error'; code: 'unauthenticated' | 'db_error' | 'no_prompts' | 'no_items' };

export interface SubmitSpeakingTurn {
  turn_number: number;
  prompt_key: string;
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  transcript?: string;
}

export type SubmitSpeakingResult =
  | { status: 'queued'; assessment_id: string }
  | { status: 'error'; code: 'invalid_audio' | 'unauthenticated' | 'db_error' };

/**
 * Starts an Assessment session for the given skill.
 * For speaking: returns question prompts from BD.
 * For listening: returns a random selection of items from bob_closed_items.
 */
export async function startAssessmentAction(skill: Skill): Promise<StartAssessmentResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  const [profileResult, historyResult] = await Promise.all([
    supabase.from('profiles').select('organization_id, cefr_active_level').eq('id', user.id).single(),
    supabase
      .from('bob_skill_level_history')
      .select('occurred_at')
      .eq('user_id', user.id)
      .eq('skill', skill)
      .eq('origin', 'assessment')
      .order('occurred_at', { ascending: false })
      .limit(1),
  ]);

  if (profileResult.error || !profileResult.data) return { status: 'error', code: 'db_error' };
  const profile = profileResult.data;

  const { data: org } = await supabase
    .from('organizations')
    .select('assessment_cooldown_days')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const cooldownDays = org?.assessment_cooldown_days ?? 7;

  const lastAssessmentRow = historyResult.data?.[0];
  if (lastAssessmentRow?.occurred_at) {
    const lastAt = new Date(lastAssessmentRow.occurred_at).getTime();
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const availableAt = lastAt + cooldownMs;
    if (Date.now() < availableAt) {
      const daysRemaining = Math.ceil((availableAt - Date.now()) / (24 * 60 * 60 * 1000));
      return {
        status: 'cooldown',
        days_remaining: daysRemaining,
        available_at: new Date(availableAt).toISOString(),
      };
    }
  }

  const { data: skillLevel } = await supabase
    .from('bob_skill_levels')
    .select('cefr_level')
    .eq('user_id', user.id)
    .eq('skill', skill)
    .maybeSingle();

  const assessment_id = crypto.randomUUID();

  if (skill === 'listening') {
    const { data: rawItems, error: itemsError } = await supabase
      .from('bob_closed_items')
      .select('id, stimulus_audio_url, transcript, question, options')
      .eq('skill', 'listening')
      .eq('status', 'enabled')
      .in('cefr_level', ['a1', 'a2', 'b1', 'b2']);

    if (itemsError || !rawItems || rawItems.length === 0) {
      return { status: 'error', code: 'no_items' };
    }

    const shuffled = [...rawItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const items: AssessmentListeningItem[] = selected.map(row => {
      const rawPath = (row.stimulus_audio_url as string) ?? '';
      const fullUrl = rawPath.startsWith('http')
        ? rawPath
        : `${supabaseUrl}/storage/v1/object/public/bob-listening${rawPath}`;
      return {
        id: row.id as string,
        audio_url: fullUrl,
        transcript: (row.transcript as string | null) ?? null,
        question: row.question as string,
        options: row.options as Array<{ key: string; label: string }>,
      };
    });

    return { status: 'ok', skill: 'listening', assessment_id, items };
  }

  if (skill === 'reading') {
    const { data: rawItems, error: itemsError } = await supabase
      .from('bob_closed_items')
      .select('id, stimulus_text, question, options')
      .eq('skill', 'reading')
      .eq('status', 'enabled')
      .in('cefr_level', ['a1', 'a2', 'b1', 'b2']);

    if (itemsError || !rawItems || rawItems.length === 0) {
      return { status: 'error', code: 'no_items' };
    }

    const shuffled = [...rawItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));

    const items: AssessmentReadingItem[] = selected.map(row => ({
      id: row.id as string,
      stimulus_text: (row.stimulus_text as string) ?? '',
      question: row.question as string,
      options: row.options as Array<{ key: string; label: string }>,
    }));

    return { status: 'ok', skill: 'reading', assessment_id, items };
  }

  if (skill === 'writing') {
    const currentLevel = skillLevel?.cefr_level ?? profile.cefr_active_level ?? 'a1';
    const isHigherRange = currentLevel === 'b1' || currentLevel === 'b2';
    const promptKey = isHigherRange
      ? 'cefr_assessment_writing_b1_b2_generation'
      : 'cefr_assessment_writing_a1_a2_generation';

    const promptText = await getPrompt(promptKey);
    if (!promptText) return { status: 'error', code: 'no_prompts' };

    const bullets = (promptText.match(/^•/gm) ?? []).length || 4;

    return {
      status: 'ok',
      skill: 'writing',
      assessment_id,
      task: { prompt_text: promptText, bullet_count: bullets },
    };
  }

  const currentLevel = skillLevel?.cefr_level ?? profile.cefr_active_level ?? 'a2';

  const { data: studentFwRows } = await supabase
    .from('student_english_frameworks')
    .select('framework_id, pedagogical_frameworks(name)')
    .eq('student_id', user.id);

  const frameworkNames = (studentFwRows ?? [])
    .map((r: Record<string, unknown>) => {
      const pf = r.pedagogical_frameworks as { name?: string } | null;
      return pf?.name ?? '';
    });

  const hasCambridge = frameworkNames.some((n: string) => n === 'Cambridge English');
  const isYlLevel = currentLevel === 'pre_a1' || currentLevel === 'a1';
  const isYl = hasCambridge && isYlLevel;

  let promptKey: string;
  if (isYl) {
    promptKey = currentLevel === 'pre_a1'
      ? 'cefr_assessment_speaking_yl_pre_a1_generation'
      : 'cefr_assessment_speaking_yl_a1_generation';
  } else {
    const isHigherRange = currentLevel === 'b1' || currentLevel === 'b2';
    promptKey = isHigherRange
      ? 'cefr_assessment_speaking_b1_b2_generation'
      : 'cefr_assessment_speaking_a1_a2_generation';
  }

  const promptText = await getPrompt(promptKey);

  const hardcodedPrompts: Record<string, AssessmentPrompt[]> = {
    'cefr_assessment_speaking_a1_a2_generation': [
      { turn_number: 1, prompt_text: 'Tell me about your school — what do you study and which subject do you like best?' },
      { turn_number: 2, prompt_text: 'Describe what you usually do on weekends.' },
      { turn_number: 3, prompt_text: 'Imagine you are in a park with friends. Tell me what is happening.' },
    ],
    'cefr_assessment_speaking_b1_b2_generation': [
      { turn_number: 1, prompt_text: 'Tell me about a memorable trip or outing you have taken. Where did you go and what made it special?' },
      { turn_number: 2, prompt_text: 'Describe how technology has changed the way young people study or communicate.' },
      { turn_number: 3, prompt_text: 'A friend is nervous about an important exam and asks for your advice. What would you say to them and why?' },
    ],
    'cefr_assessment_speaking_yl_pre_a1_generation': [
      { turn_number: 1, prompt_text: 'Hi! What is your name?' },
      { turn_number: 2, prompt_text: 'How old are you? And what is your favourite colour? 🎨' },
      { turn_number: 3, prompt_text: 'Tell me about your family. How many people are in your family? 👨‍👩‍👧' },
    ],
    'cefr_assessment_speaking_yl_a1_generation': [
      { turn_number: 1, prompt_text: 'What do you like to do after school? ⭐' },
      { turn_number: 2, prompt_text: 'Tell me about your favourite animal. What does it look like? 🐾' },
      { turn_number: 3, prompt_text: 'What is the weather like today? Do you like this kind of weather? ☀️' },
    ],
  };

  void promptText;

  const prompts = hardcodedPrompts[promptKey] ?? [];
  if (prompts.length === 0) return { status: 'error', code: 'no_prompts' };

  return { status: 'ok', skill: 'speaking', assessment_id, prompts, is_yl: isYl };
}

/**
 * Submits the recorded audio turns for Speaking Assessment.
 * Returns queued immediately (fire-and-forget); evaluation runs in background.
 * D-A1 compliance: never blocks the student waiting for Gemini.
 */
export async function submitAssessmentSpeakingAction(
  assessment_id: string,
  turns: SubmitSpeakingTurn[]
): Promise<SubmitSpeakingResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  if (!turns || turns.length === 0 || turns.length > 3) {
    return { status: 'error', code: 'invalid_audio' };
  }

  const totalDurationMs = turns.reduce((acc, t) => acc + t.duration_ms, 0);
  if (totalDurationMs > 3 * 20 * 1000) {
    return { status: 'error', code: 'invalid_audio' };
  }

  const [profileResult, skillLevelResult, studentFwResult] = await Promise.all([
    supabase.from('profiles').select('organization_id, cefr_active_level').eq('id', user.id).single(),
    supabase.from('bob_skill_levels').select('cefr_level').eq('user_id', user.id).eq('skill', 'speaking').maybeSingle(),
    supabase.from('student_english_frameworks').select('framework_id, pedagogical_frameworks(name)').eq('student_id', user.id),
  ]);

  const profile = profileResult.data;

  const { data: org } = profile?.organization_id
    ? await supabase
        .from('organizations')
        .select('allow_voice_storage')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null };

  const allowVoiceStorage = org?.allow_voice_storage === true;

  const speakingLevel = skillLevelResult.data?.cefr_level ?? profile?.cefr_active_level ?? 'a2';
  const fwNames = (studentFwResult.data ?? []).map((r: Record<string, unknown>) => {
    const pf = r.pedagogical_frameworks as { name?: string } | null;
    return pf?.name ?? '';
  });
  const isYl = fwNames.some((n: string) => n === 'Cambridge English') && (speakingLevel === 'pre_a1' || speakingLevel === 'a1');

  const { data: session, error: sessionError } = await supabase
    .from('bob_sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_speaking',
      topic: assessment_id,
      title: 'Speaking Assessment',
    })
    .select('id')
    .single();

  if (sessionError || !session) return { status: 'error', code: 'db_error' };
  const sessionId = session.id;

  for (const turn of turns) {
    const msgInsert: Record<string, unknown> = {
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      msg_type: allowVoiceStorage ? 'user_audio' : 'text',
      content_text: turn.transcript ?? null,
      content_json: {
        assessment_id,
        turn_number: turn.turn_number,
        duration_ms: turn.duration_ms,
        prompt_key: turn.prompt_key,
        ...(allowVoiceStorage ? { audio_base64: turn.audio_base64, mime_type: turn.mime_type } : {}),
      },
    };
    await supabase.from('bob_messages').insert(msgInsert);
  }

  await supabase
    .from('bob_messages')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'bob',
      msg_type: 'evaluation',
      content_text: null,
      content_json: { assessment_id, status: 'pending' },
    });

  const { error: queueError } = await supabase
    .from('bob_assessment_queue')
    .insert({
      user_id: user.id,
      assessment_id,
      skill: 'speaking',
      session_id: sessionId,
      status: 'pending',
      payload: {
        current_level: speakingLevel,
        is_yl: isYl,
      },
    });

  if (queueError) {
    return { status: 'error', code: 'db_error' };
  }

  return { status: 'queued', assessment_id };
}

export interface SubmitListeningAnswer {
  item_id: string;
  selected_key: string;
}

export type SubmitListeningResult =
  | { status: 'ok'; result: AssessmentResultListening }
  | { status: 'error'; code: 'unauthenticated' | 'invalid_items' | 'db_error' };

/**
 * Scores a completed Listening Assessment deterministically.
 * No LLM call — pure comparison against bob_closed_items.correct_key.
 * D-D1 compliance: zero Gemini calls on this path.
 */
export async function submitAssessmentListeningAction(
  assessment_id: string,
  answers: SubmitListeningAnswer[]
): Promise<SubmitListeningResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  if (!answers || answers.length === 0) {
    return { status: 'error', code: 'invalid_items' };
  }

  const itemIds = answers.map(a => a.item_id);
  const { data: items, error: itemsError } = await supabase
    .from('bob_closed_items')
    .select('id, correct_key, explanation')
    .in('id', itemIds);

  if (itemsError || !items) return { status: 'error', code: 'db_error' };

  const correctMap = new Map<string, string>(
    items.map(row => [row.id as string, row.correct_key as string])
  );

  let correct = 0;
  const failedItemIds: string[] = [];

  for (const answer of answers) {
    const expectedKey = correctMap.get(answer.item_id);
    if (expectedKey !== undefined && answer.selected_key === expectedKey) {
      correct++;
    } else {
      failedItemIds.push(answer.item_id);
    }
  }

  const total = answers.length;
  const { band, confidence } = mapListeningScoreToCefr(correct, total);

  const confidenceNumeric = confidence === 'low' ? 0.3
    : confidence === 'medium' ? 0.65
    : 0.9;

  try {
    await supabase.rpc('set_config', { setting: 'bob.assessment_id', value: assessment_id, is_local: true });
  } catch { /* non-critical */ }

  const { error: upsertError } = await supabase
    .from('bob_skill_levels')
    .upsert({
      user_id: user.id,
      skill: 'listening',
      cefr_level: band,
      origin: 'assessment',
      confidence: confidenceNumeric,
      last_assessment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,skill' });

  if (upsertError) return { status: 'error', code: 'db_error' };

  const { data: sessionData, error: sessionError } = await supabase
    .from('bob_sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_listening',
      topic: assessment_id,
      title: 'Listening Assessment',
    })
    .select('id')
    .single();

  if (!sessionError && sessionData) {
    await supabase.from('bob_messages').insert({
      session_id: sessionData.id,
      user_id: user.id,
      role: 'bob',
      msg_type: 'evaluation',
      content_text: null,
      content_json: {
        assessment_id,
        status: 'done',
        score: correct,
        score_max: total,
        cefr_band: band,
        confidence,
        failed_item_ids: failedItemIds,
      },
    });
  }

  const cooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const result: AssessmentResultListening = {
    assessment_id,
    skill: 'listening',
    cefr_band: band,
    confidence,
    score: correct,
    score_max: total,
    failed_item_ids: failedItemIds,
    cooldown_until: cooldownUntil,
    feedback: {
      kind: 'formative',
      understood: correct >= Math.ceil(total / 2),
      highlights: correct === total
        ? ['You answered all questions correctly — great listening skills!']
        : [`You got ${correct} out of ${total} correct.`],
      suggestions: failedItemIds.length > 0
        ? ['Review the items you missed and listen to them again.']
        : [],
    },
  };

  return { status: 'ok', result };
}

/**
 * Polls for the Assessment Speaking result.
 * Returns the result if done, 'pending' if still evaluating, or 'failed' on error.
 */
export async function pollAssessmentSpeakingResultAction(
  assessment_id: string
): Promise<
  | { status: 'done'; result: AssessmentResultSpeaking }
  | { status: 'pending' }
  | { status: 'failed'; error: string }
  | { status: 'error'; code: string }
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  const { data: messages } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('user_id', user.id)
    .eq('role', 'bob')
    .eq('msg_type', 'evaluation')
    .filter('content_json->>assessment_id', 'eq', assessment_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!messages || messages.length === 0) return { status: 'pending' };

  const content = messages[0].content_json as Record<string, unknown>;
  if (!content) return { status: 'pending' };

  const msgStatus = content.status as string;

  if (msgStatus === 'pending') return { status: 'pending' };

  if (msgStatus === 'failed') {
    return { status: 'failed', error: (content.error as string) ?? 'Evaluation failed' };
  }

  if (msgStatus === 'done') {
    const cooldownUntil = (content.cooldown_until as string) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      status: 'done',
      result: {
        assessment_id,
        skill: 'speaking',
        cefr_band: content.cefr_band as AssessmentCefrBand,
        confidence: content.confidence as AssessmentConfidence,
        feedback: content.feedback as AssessmentResultSpeaking['feedback'],
        cooldown_until: cooldownUntil,
        pending_evaluation: false,
      },
    };
  }

  return { status: 'pending' };
}

export interface SubmitReadingAnswer {
  item_id: string;
  selected_key: string;
}

export type SubmitReadingResult =
  | { status: 'ok'; result: AssessmentResultReading }
  | { status: 'error'; code: 'unauthenticated' | 'invalid_items' | 'db_error' };

/**
 * Scores a completed Reading Assessment deterministically.
 * No LLM call — pure comparison against bob_closed_items.correct_key.
 * D-D1 compliance: zero Gemini calls on this path.
 */
export async function submitAssessmentReadingAction(
  assessment_id: string,
  answers: SubmitReadingAnswer[]
): Promise<SubmitReadingResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  if (!answers || answers.length === 0) {
    return { status: 'error', code: 'invalid_items' };
  }

  const itemIds = answers.map(a => a.item_id);
  const { data: items, error: itemsError } = await supabase
    .from('bob_closed_items')
    .select('id, correct_key, explanation')
    .in('id', itemIds);

  if (itemsError || !items) return { status: 'error', code: 'db_error' };

  const correctMap = new Map<string, string>(
    items.map(row => [row.id as string, row.correct_key as string])
  );

  let correct = 0;
  const failedItemIds: string[] = [];

  for (const answer of answers) {
    const expectedKey = correctMap.get(answer.item_id);
    if (expectedKey !== undefined && answer.selected_key === expectedKey) {
      correct++;
    } else {
      failedItemIds.push(answer.item_id);
    }
  }

  const total = answers.length;
  const { band, confidence } = mapListeningScoreToCefr(correct, total);

  const confidenceNumeric = confidence === 'low' ? 0.3
    : confidence === 'medium' ? 0.65
    : 0.9;

  try {
    await supabase.rpc('set_config', { setting: 'bob.assessment_id', value: assessment_id, is_local: true });
  } catch { /* non-critical */ }

  const { error: upsertError } = await supabase
    .from('bob_skill_levels')
    .upsert({
      user_id: user.id,
      skill: 'reading',
      cefr_level: band,
      origin: 'assessment',
      confidence: confidenceNumeric,
      last_assessment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,skill' });

  if (upsertError) return { status: 'error', code: 'db_error' };

  const { data: sessionData, error: sessionError } = await supabase
    .from('bob_sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_reading',
      topic: assessment_id,
      title: 'Reading Assessment',
    })
    .select('id')
    .single();

  if (!sessionError && sessionData) {
    await supabase.from('bob_messages').insert({
      session_id: sessionData.id,
      user_id: user.id,
      role: 'bob',
      msg_type: 'evaluation',
      content_text: null,
      content_json: {
        assessment_id,
        status: 'done',
        score: correct,
        score_max: total,
        cefr_band: band,
        confidence,
        failed_item_ids: failedItemIds,
      },
    });
  }

  const cooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const result: AssessmentResultReading = {
    assessment_id,
    skill: 'reading',
    cefr_band: band,
    confidence,
    score: correct,
    score_max: total,
    failed_item_ids: failedItemIds,
    cooldown_until: cooldownUntil,
    feedback: {
      kind: 'formative',
      understood: correct >= Math.ceil(total / 2),
      highlights: correct === total
        ? ['You answered all questions correctly — excellent reading comprehension!']
        : [`You got ${correct} out of ${total} correct.`],
      suggestions: failedItemIds.length > 0
        ? ['Re-read the texts for the questions you missed and look for the key information.']
        : [],
    },
  };

  return { status: 'ok', result };
}

export type SubmitWritingResult =
  | { status: 'queued'; assessment_id: string }
  | { status: 'error'; code: 'unauthenticated' | 'db_error' | 'text_too_short' };

/**
 * Persists the student's written text and fires background evaluation.
 * D-A1 compliance: returns 'queued' immediately; Gemini runs in background.
 */
export async function submitAssessmentWritingAction(
  assessment_id: string,
  written_text: string
): Promise<SubmitWritingResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  const wordCount = written_text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) return { status: 'error', code: 'text_too_short' };

  const [profileResult, skillLevelResult] = await Promise.all([
    supabase.from('profiles').select('cefr_active_level').eq('id', user.id).single(),
    supabase.from('bob_skill_levels').select('cefr_level').eq('user_id', user.id).eq('skill', 'writing').maybeSingle(),
  ]);

  const profile = profileResult.data;
  const writingLevel = skillLevelResult.data?.cefr_level ?? profile?.cefr_active_level ?? 'a1';

  const { data: session, error: sessionError } = await supabase
    .from('bob_sessions')
    .insert({
      user_id: user.id,
      mode: 'assessment_writing',
      topic: assessment_id,
      title: 'Writing Assessment',
    })
    .select('id')
    .single();

  if (sessionError || !session) return { status: 'error', code: 'db_error' };
  const sessionId = session.id;

  await supabase.from('bob_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    msg_type: 'text',
    content_text: written_text,
    content_json: { assessment_id, word_count: wordCount },
  });

  await supabase.from('bob_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'bob',
    msg_type: 'evaluation',
    content_text: null,
    content_json: { assessment_id, status: 'pending' },
  });

  const { error: queueError } = await supabase
    .from('bob_assessment_queue')
    .insert({
      user_id: user.id,
      assessment_id,
      skill: 'writing',
      session_id: sessionId,
      status: 'pending',
      payload: {
        current_level: writingLevel,
        written_text,
      },
    });

  if (queueError) {
    return { status: 'error', code: 'db_error' };
  }

  return { status: 'queued', assessment_id };
}

/**
 * Polls for the Writing Assessment result.
 * Returns 'done' with result, 'pending' if still evaluating, or 'failed' on error.
 */
export async function pollAssessmentWritingResultAction(
  assessment_id: string
): Promise<
  | { status: 'done'; result: AssessmentResultWriting }
  | { status: 'pending' }
  | { status: 'failed'; error: string }
  | { status: 'error'; code: string }
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', code: 'unauthenticated' };

  const { data: messages } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('user_id', user.id)
    .eq('role', 'bob')
    .eq('msg_type', 'evaluation')
    .filter('content_json->>assessment_id', 'eq', assessment_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!messages || messages.length === 0) return { status: 'pending' };

  const content = messages[0].content_json as Record<string, unknown>;
  if (!content) return { status: 'pending' };

  const msgStatus = content.status as string;

  if (msgStatus === 'pending') return { status: 'pending' };

  if (msgStatus === 'failed') {
    return { status: 'failed', error: (content.error as string) ?? 'Evaluation failed' };
  }

  if (msgStatus === 'done') {
    const cooldownUntil = (content.cooldown_until as string) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      status: 'done',
      result: {
        assessment_id,
        skill: 'writing',
        cefr_band: content.cefr_band as AssessmentCefrBand,
        confidence: content.confidence as AssessmentConfidence,
        bullets_covered: (content.bullets_covered as number) ?? 0,
        feedback: content.feedback as AssessmentWritingFeedback,
        cooldown_until: cooldownUntil,
      },
    };
  }

  return { status: 'pending' };
}

export type PendingAssessmentEntry = { assessment_id: string; started_at: string | null } | null;
export type PendingAssessmentsMap = Record<Skill, PendingAssessmentEntry>;

/**
 * Returns the most recent pending or processing queue row per skill for the current user.
 * Used by the dashboard to show "Evaluating…" overlay on SkillRing while the Edge Function works.
 */
export async function getPendingAssessmentsAction(): Promise<PendingAssessmentsMap> {
  const empty: PendingAssessmentsMap = { speaking: null, listening: null, reading: null, writing: null };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data } = await supabase
    .from('bob_assessment_queue')
    .select('skill, assessment_id, started_at')
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false });

  const result: PendingAssessmentsMap = { speaking: null, listening: null, reading: null, writing: null };

  for (const row of (data ?? []) as Array<{ skill: string; assessment_id: string; started_at: string | null }>) {
    const skill = row.skill as Skill;
    if (result[skill] === null) {
      result[skill] = { assessment_id: row.assessment_id, started_at: row.started_at };
    }
  }

  return result;
}
