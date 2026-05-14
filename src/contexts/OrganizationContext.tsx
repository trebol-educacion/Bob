'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Organization, getOrganizationForUser } from '@/lib/organization';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { resolveEnabledModes } from '@/lib/modes';
import type { ModeKey, ModeFramework, CefrLevel } from '@/lib/types/practice';

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
  const [cefrActiveLevel, setCefrActiveLevelState] = useState<CefrLevel | null>(null);
  const [cefrLevelLocked, setCefrLevelLocked] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [accessDenialReason, setAccessDenialReason] = useState<BobAccessDenialReason | null>(null);

  // Cached framework data for re-running resolveEnabledModes on level change
  const [cachedOrg, setCachedOrg] = useState<Organization | null>(null);
  const [cachedStudentFrameworks, setCachedStudentFrameworks] = useState<ModeFramework[]>([]);
  const [cachedOrgFrameworks, setCachedOrgFrameworks] = useState<ModeFramework[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    (async () => {
      // Try session first (sync read from cookies / storage). getUser validates
      // remotely and can return null in incognito or transient network issues.
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

        // Parallel fetch: profile (role + CEFR), student frameworks, org frameworks
        const [profileResult, studentFwResult, orgFwResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('role, cefr_active_level, cefr_level_locked')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('student_english_frameworks')
            .select('framework_id, pedagogical_frameworks(name, type)')
            .eq('user_id', userId),
          supabase
            .from('organization_frameworks')
            .select('framework_id, pedagogical_frameworks(name, type)')
            .eq('organization_id', org?.id ?? ''),
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

        const activeLevel = (profileResult.data?.cefr_active_level ?? null) as CefrLevel | null;
        const levelLocked = profileResult.data?.cefr_level_locked ?? false;
        const role = (profileResult.data?.role ?? null) as string | null;

        setCefrActiveLevelState(activeLevel);
        setCefrLevelLocked(levelLocked);
        setUserRole(role);

        // Access gate — don't trigger denial when profile query errored (likely transient RLS / cookie hydration)
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

        const modes = resolveEnabledModes({
          isBobEnabled: org?.is_bob_enabled ?? false,
          studentActiveCefr: activeLevel,
          studentFrameworks,
          orgFrameworks,
        });

        setEnabledModes(modes);
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

    // Optimistic update
    setCefrActiveLevelState(level);

    const newModes = resolveEnabledModes({
      isBobEnabled: cachedOrg?.is_bob_enabled ?? true,
      studentActiveCefr: level,
      studentFrameworks: cachedStudentFrameworks,
      orgFrameworks: cachedOrgFrameworks,
    });
    setEnabledModes(newModes);
  }, [cefrLevelLocked, cachedOrg, cachedStudentFrameworks, cachedOrgFrameworks]);

  const accessGranted = accessDenialReason === null && !loading;

  return (
    <OrganizationContext.Provider value={{
      organization,
      loading,
      enabledModes,
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
