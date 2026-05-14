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

interface OrganizationContextValue {
  organization: Organization | null;
  loading: boolean;
  enabledModes: ModeKey[];
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
  setCefrActiveLevel: (level: CefrLevel) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  loading: true,
  enabledModes: ['generic_situation', 'generic_image', 'generic_conversation'],
  cefrActiveLevel: null,
  cefrLevelLocked: false,
  setCefrActiveLevel: async () => {},
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

  // Cached framework data for re-running resolveEnabledModes on level change
  const [cachedOrg, setCachedOrg] = useState<Organization | null>(null);
  const [cachedStudentFrameworks, setCachedStudentFrameworks] = useState<ModeFramework[]>([]);
  const [cachedOrgFrameworks, setCachedOrgFrameworks] = useState<ModeFramework[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }

      const userId = data.user.id;

      try {
        const org = await getOrganizationForUser(userId);
        setOrganization(org);
        setCachedOrg(org);

        if (!org) {
          // Individual user without org — Bob fully accessible with all generic modes
          setEnabledModes(['generic_situation', 'generic_image', 'generic_conversation']);
          setLoading(false);
          return;
        }

        // Parallel fetch: student CEFR active level, student frameworks, org frameworks
        const [profileResult, studentFwResult, orgFwResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('cefr_active_level, cefr_level_locked')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('student_english_frameworks')
            .select('framework_id, pedagogical_frameworks(name, type)')
            .eq('user_id', userId),
          supabase
            .from('organization_frameworks')
            .select('framework_id, pedagogical_frameworks(name, type)')
            .eq('organization_id', org.id),
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

        setCefrActiveLevelState(activeLevel);
        setCefrLevelLocked(levelLocked);

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
          isBobEnabled: org.is_bob_enabled,
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
    });
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

  return (
    <OrganizationContext.Provider value={{
      organization,
      loading,
      enabledModes,
      cefrActiveLevel,
      cefrLevelLocked,
      setCefrActiveLevel,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
