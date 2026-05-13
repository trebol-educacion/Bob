'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  loading: true,
  enabledModes: ['situation', 'image', 'conversation'],
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabledModes, setEnabledModes] = useState<ModeKey[]>([
    'situation',
    'image',
    'conversation',
  ]);

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

        if (!org) {
          // Individual user without org — Bob fully accessible with all generic modes
          setEnabledModes(['situation', 'image', 'conversation']);
          setLoading(false);
          return;
        }

        // Parallel fetch: student CEFR levels, student frameworks, org frameworks
        const [profileResult, studentFwResult, orgFwResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('cefr_levels')
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

        const cefrLevels: string[] = profileResult.data?.cefr_levels ?? [];

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

        const modes = resolveEnabledModes({
          isBobEnabled: org.is_bob_enabled,
          studentCefrLevels: cefrLevels as CefrLevel[],
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

  return (
    <OrganizationContext.Provider value={{ organization, loading, enabledModes }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
