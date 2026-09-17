import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { resolveBobAccessDenial } from '@/lib/access-gate';
import type { Organization } from '@/lib/organization';
import type { CefrLevel, DynamicCard, ModeFramework, ModeKey } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';
import { mapSkillLevelRows, type RawSkillLevelRow } from './skill-levels';
import { computeEnabledModes } from './enabled-modes';
import { dedupeAvailableModes, dedupeDynamicCards, type RawAvailableModeRow, type RawDynamicCardRow } from './catalog';
import { extractOrgFrameworks, extractStudentFrameworks, type FrameworkQueryRow } from './frameworks';
import type { AvailableMode, BobAccessDenialReason } from './types';

export interface OrganizationDataBundle {
  activeLevel: CefrLevel | null;
  levelLocked: boolean;
  role: string | null;
  skillLevels: SkillLevelMap;
  assessmentCooldownDays: number;
  accessDenialReason: BobAccessDenialReason | null;
  studentFrameworks: ModeFramework[];
  orgFrameworks: ModeFramework[];
  allDynamicCards: DynamicCard[];
  enabledModes: ModeKey[];
  availableModes: AvailableMode[];
}

export async function loadOrganizationData(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  userId: string,
  org: Organization | null,
): Promise<OrganizationDataBundle> {
  const [profileResult, studentFwResult, orgFwResult, availableModesResult, allCardsResult, skillLevelsResult, cooldownResult, licenseResult] = await Promise.all([
    supabase
      .schema('public').from('profiles')
      .select('role, cefr_active_level, cefr_level_locked')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .schema('public').from('student_english_frameworks')
      .select('framework_id, pedagogical_frameworks(name, type)')
      .eq('user_id', userId),
    org?.id
      ? supabase
          .schema('public').from('organization_frameworks')
          .select('framework_id, pedagogical_frameworks(name, type)')
          .eq('organization_id', org.id)
      : Promise.resolve({ data: [], error: null } as { data: never[]; error: null }),
    supabase
      .from('prompts')
      .select('framework, exam_part, cefr_level, label, description')
      .eq('activity_type', 'generation')
      .neq('framework', 'generic')
      .order('framework')
      .order('cefr_level', { ascending: true, nullsFirst: false })
      .order('exam_part'),
    supabase
      .from('prompts')
      .select('framework, exam_part, cefr_level, label, description, status, skill')
      .eq('activity_type', 'generation')
      .neq('status', 'hidden')
      .order('framework')
      .order('cefr_level', { ascending: true, nullsFirst: false })
      .order('exam_part'),
    supabase
      .from('skill_levels')
      .select('skill, cefr_level, origin, confidence, last_assessment_at, updated_at')
      .eq('user_id', userId),
    org?.id
      ? supabase
          .schema('public').from('organizations')
          .select('assessment_cooldown_days')
          .eq('id', org.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.schema('public').rpc('has_product_access', { p_user_id: userId, p_product_code: 'bob' }),
  ]);

  if (profileResult.error) {
    console.error('[OrganizationContext] profiles query failed:', profileResult.error);
  }
  if (studentFwResult.error) {
    console.error('[OrganizationContext] student_english_frameworks query failed:', studentFwResult.error);
  }
  if (orgFwResult.error) {
    console.error('[OrganizationContext] organization_frameworks query failed:', orgFwResult.error);
  }
  if (availableModesResult.error) {
    console.error('[OrganizationContext] bob_prompts (availableModes) query failed:', availableModesResult.error);
  }
  if (allCardsResult.error) {
    console.error('[OrganizationContext] bob_prompts (allDynamicCards) query failed:', allCardsResult.error);
  }
  if (skillLevelsResult.error) {
    console.error('[OrganizationContext] bob_skill_levels query failed:', skillLevelsResult.error);
  }
  if (cooldownResult.error) {
    console.error('[OrganizationContext] organizations cooldown query failed:', cooldownResult.error);
  }

  const activeLevel = (profileResult.data?.cefr_active_level ?? null) as CefrLevel | null;
  const levelLocked = profileResult.data?.cefr_level_locked ?? false;
  const role = (profileResult.data?.role ?? null) as string | null;

  const skillLevels = mapSkillLevelRows((skillLevelsResult.data ?? []) as RawSkillLevelRow[]);
  const assessmentCooldownDays = cooldownResult.data?.assessment_cooldown_days ?? 7;

  if (licenseResult.error) {
    console.warn('[Bob access gate] has_product_access errored, fail-open', licenseResult.error);
  }
  const accessDenialReason = resolveBobAccessDenial({
    profileErrored: !!profileResult.error,
    hasProfile: !!profileResult.data,
    role,
    orgFound: !!org,
    bobEnabled: org?.is_bob_enabled,
    licenseResult: licenseResult.error ? null : (licenseResult.data as boolean | null),
  });
  if (accessDenialReason) {
    console.warn('[Bob access gate] access denied:', accessDenialReason, 'user:', userId);
  }

  const studentFrameworks = extractStudentFrameworks((studentFwResult.data ?? []) as FrameworkQueryRow[]);
  const orgFrameworks = extractOrgFrameworks((orgFwResult.data ?? []) as FrameworkQueryRow[]);

  const allDynamicCards = dedupeDynamicCards((allCardsResult.data ?? []) as RawDynamicCardRow[]);

  const effectiveFrameworks = studentFrameworks.filter(f => orgFrameworks.includes(f));
  const enabledModes = computeEnabledModes({
    isBobEnabled: org?.is_bob_enabled ?? false,
    cards: allDynamicCards,
    activeLevel,
    effectiveFrameworks,
    hasAssignedFrameworks: effectiveFrameworks.length > 0,
  });

  const availableModes = dedupeAvailableModes((availableModesResult.data ?? []) as RawAvailableModeRow[]);

  return {
    activeLevel,
    levelLocked,
    role,
    skillLevels,
    assessmentCooldownDays,
    accessDenialReason,
    studentFrameworks,
    orgFrameworks,
    allDynamicCards,
    enabledModes,
    availableModes,
  };
}
