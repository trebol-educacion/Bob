'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { getPrompt } from '@/lib/prompts/db-prompts';
import type { Skill } from '@/lib/types/skills';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask, StartAssessmentResult } from './types';

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
    supabase.schema('public').from('profiles').select('organization_id, cefr_active_level').eq('id', user.id).single(),
    supabase
      .from('skill_level_history')
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
    .schema('public').from('organizations')
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
    .from('skill_levels')
    .select('cefr_level')
    .eq('user_id', user.id)
    .eq('skill', skill)
    .maybeSingle();

  const assessment_id = crypto.randomUUID();

  if (skill === 'listening') {
    const { data: rawItems, error: itemsError } = await supabase
      .from('closed_items')
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
      .from('closed_items')
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
    .schema('public').from('student_english_frameworks')
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

