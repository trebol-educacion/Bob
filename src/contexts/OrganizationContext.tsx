'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Organization, getOrganizationForUser } from '@/lib/organization';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { resolveEnabledModes } from '@/lib/modes';
import type { ModeKey, ModeFramework, CefrLevel, DynamicCard } from '@/lib/types/practice';

/** AvailableMode — a mode row fetched from bob_prompts (DB-driven). */
export interface AvailableMode {
  framework: ModeFramework;
  exam_part: string;
  cefr_level: CefrLevel | null;
  label: string;
  description: string | null;
}

const FRAMEWORK_NAME_MAP: Record<string, ModeFramework> = {
  'Cambridge English': 'cambridge',
  'TOEFL iBT': 'toefl',
};

function normalizeFrameworkName(name: string): ModeFramework | null {
  return FRAMEWORK_NAME_MAP[name] ?? null;
}

export type BobAccessDenialReason =
  | 'not_authenticated'
  | 'no_profile'
  | 'not_student'
  | 'no_organization'
  | 'bob_not_enabled';

interface OrganizationContextValue {
  organization: Organization | null;
  loading: boolean;
  enabledModes: ModeKey[];
  /** DB-driven list of available modes from bob_prompts (generation rows, non-generic). */
  availableModes: AvailableMode[];
  /**
   * DB-driven full catalog from bob_prompts (all `activity_type='generation'` rows
   * including generic_*). Source of truth for ModeSelection in B3. Derived once at
   * mount; consumers filter client-side per spec §2.2. (bob-core T2.3, D9-1, D9-3.)
   */
  allDynamicCards: DynamicCard[];
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
  setCefrActiveLevel: (level: CefrLevel) => Promise<void>;
  userRole: string | null;
  accessGranted: boolean;
  accessDenialReason: BobAccessDenialReason | null;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  loading: true,
  enabledModes: ['generic_situation', 'generic_image', 'generic_conversation'],
  availableModes: [],
  allDynamicCards: [],
  cefrActiveLevel: null,
  cefrLevelLocked: false,
  setCefrActiveLevel: async () => {},
  userRole: null,
  accessGranted: false,
  accessDenialReason: null,
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabledModes, setEnabledModes] = useState<ModeKey[]>([
    'generic_situation',
    'generic_image',
    'generic_conversation',
  ]);
  const [availableModes, setAvailableModes] = useState<AvailableMode[]>([]);
  const [allDynamicCards, setAllDynamicCards] = useState<DynamicCard[]>([]);
  const [cefrActiveLevel, setCefrActiveLevelState] = useState<CefrLevel | null>(null);
  const [cefrLevelLocked, setCefrLevelLocked] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [accessDenialReason, setAccessDenialReason] = useState<BobAccessDenialReason | null>(null);

  // Cached for re-running resolveEnabledModes on CEFR level change without a full re-fetch.
  const [cachedOrg, setCachedOrg] = useState<Organization | null>(null);
  const [cachedStudentFrameworks, setCachedStudentFrameworks] = useState<ModeFramework[]>([]);
  const [cachedOrgFrameworks, setCachedOrgFrameworks] = useState<ModeFramework[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    (async () => {
      // getSession reads from cookies/storage (fast); getUser validates remotely — can
      // return null in incognito or on transient network issues, so we fall back.
      const sessionRes = await supabase.auth.getSession();
      let user = sessionRes.data.session?.user ?? null;

      if (!user) {
        const userRes = await supabase.auth.getUser();
        if (userRes.error) {
          console.warn('[Bob access] getUser error:', userRes.error.message);
        }
        user = userRes.data.user ?? null;
      }

      if (!user) {
        console.warn('[Bob access] No client-side session despite middleware passthrough.');
        setAccessDenialReason('not_authenticated');
        setLoading(false);
        return;
      }

      const userId = user.id;

      try {
        const org = await getOrganizationForUser(userId);
        setOrganization(org);
        setCachedOrg(org);

        const [profileResult, studentFwResult, orgFwResult, availableModesResult, allCardsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('role, cefr_active_level, cefr_level_locked')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('student_english_frameworks')
            .select('framework_id, pedagogical_frameworks(name, type)')
            .eq('user_id', userId),
          org?.id
            ? supabase
                .from('organization_frameworks')
                .select('framework_id, pedagogical_frameworks(name, type)')
                .eq('organization_id', org.id)
            : Promise.resolve({ data: [], error: null } as { data: never[]; error: null }),
          supabase
            .from('bob_prompts')
            .select('framework, exam_part, cefr_level, label, description')
            .eq('activity_type', 'generation')
            .neq('framework', 'generic')
            .order('framework')
            .order('cefr_level', { ascending: true, nullsFirst: false })
            .order('exam_part'),
          supabase
            .from('bob_prompts')
            .select('framework, exam_part, cefr_level, label, description, status')
            .eq('activity_type', 'generation')
            .neq('status', 'hidden')
            .order('framework')
            .order('cefr_level', { ascending: true, nullsFirst: false })
            .order('exam_part'),
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

        const activeLevel = (profileResult.data?.cefr_active_level ?? null) as CefrLevel | null;
        const levelLocked = profileResult.data?.cefr_level_locked ?? false;
        const role = (profileResult.data?.role ?? null) as string | null;

        setCefrActiveLevelState(activeLevel);
        setCefrLevelLocked(levelLocked);
        setUserRole(role);

        if (profileResult.error) {
          console.warn('[Bob access gate] profile query errored, deferring denial', profileResult.error);
          setAccessDenialReason(null);
        } else if (!profileResult.data) {
          console.warn('[Bob access gate] no profile data for user', userId);
          setAccessDenialReason('no_profile');
        } else if (role !== 'student') {
          console.warn('[Bob access gate] role is not student:', role);
          setAccessDenialReason('not_student');
        } else if (!org) {
          setAccessDenialReason('no_organization');
        } else if (!org.is_bob_enabled) {
          setAccessDenialReason('bob_not_enabled');
        } else {
          setAccessDenialReason(null);
        }

        const studentFrameworks: ModeFramework[] = (studentFwResult.data ?? [])
          .map((r: any) => {
            const name = r.pedagogical_frameworks?.name as string | undefined;
            return name ? normalizeFrameworkName(name) : null;
          })
          .filter((f): f is ModeFramework => f !== null);

        const orgFrameworks: ModeFramework[] = (orgFwResult.data ?? [])
          .filter((r: any) => r.pedagogical_frameworks?.type === 'english')
          .map((r: any) => {
            const name = r.pedagogical_frameworks?.name as string | undefined;
            return name ? normalizeFrameworkName(name) : null;
          })
          .filter((f): f is ModeFramework => f !== null);

        setCachedStudentFrameworks(studentFrameworks);
        setCachedOrgFrameworks(orgFrameworks);

        const rawAll = (allCardsResult.data ?? []) as Array<{
          framework: string;
          exam_part: string;
          cefr_level: string | null;
          label: string;
          description: string | null;
          status: string;
        }>;
        const seenAll = new Set<string>();
        const dedupedAll: DynamicCard[] = [];
        for (const row of rawAll) {
          const key = `${row.framework}|${row.exam_part}|${row.cefr_level ?? ''}`;
          if (!seenAll.has(key)) {
            seenAll.add(key);
            const status = (row.status === 'coming_soon' || row.status === 'enabled')
              ? row.status
              : 'enabled';
            dedupedAll.push({
              framework: row.framework,
              exam_part: row.exam_part,
              cefr_level: (row.cefr_level ?? null) as CefrLevel | null,
              label: row.label,
              description: row.description,
              mode_key: `${row.framework}_${row.exam_part}`,
              status,
            });
          }
        }
        setAllDynamicCards(dedupedAll);

        const modes = resolveEnabledModes({
          isBobEnabled: org?.is_bob_enabled ?? false,
          studentActiveCefr: activeLevel,
          studentFrameworks,
          orgFrameworks,
          allDynamicCards: dedupedAll,
        });

        setEnabledModes(modes);

        const rawModes = (availableModesResult.data ?? []) as Array<{
          framework: string;
          exam_part: string;
          cefr_level: string | null;
          label: string;
          description: string | null;
        }>;
        const seen = new Set<string>();
        const deduped: AvailableMode[] = [];
        for (const row of rawModes) {
          const key = `${row.framework}|${row.exam_part}|${row.cefr_level ?? ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push({
              framework: row.framework as ModeFramework,
              exam_part: row.exam_part,
              cefr_level: (row.cefr_level ?? null) as CefrLevel | null,
              label: row.label,
              description: row.description,
            });
          }
        }
        setAvailableModes(deduped);
      } catch (err) {
        console.error('[OrganizationContext] Unexpected error loading org data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setCefrActiveLevel = useCallback(async (level: CefrLevel) => {
    if (cefrLevelLocked) {
      throw new Error('Tu colegio bloqueó tu nivel CEFR y no puede cambiarse.');
    }

    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado.');

    const { error } = await supabase
      .from('profiles')
      .update({ cefr_active_level: level })
      .eq('id', user.id);

    if (error) {
      console.error('[OrganizationContext] setCefrActiveLevel failed:', error);
      throw new Error(error.message);
    }

    setCefrActiveLevelState(level);

    const newModes = resolveEnabledModes({
      isBobEnabled: cachedOrg?.is_bob_enabled ?? true,
      studentActiveCefr: level,
      studentFrameworks: cachedStudentFrameworks,
      orgFrameworks: cachedOrgFrameworks,
      allDynamicCards,
    });
    setEnabledModes(newModes);
  }, [cefrLevelLocked, cachedOrg, cachedStudentFrameworks, cachedOrgFrameworks, allDynamicCards]);

  const accessGranted = accessDenialReason === null && !loading;

  return (
    <OrganizationContext.Provider value={{
      organization,
      loading,
      enabledModes,
      availableModes,
      allDynamicCards,
      cefrActiveLevel,
      cefrLevelLocked,
      setCefrActiveLevel,
      userRole,
      accessGranted,
      accessDenialReason,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
