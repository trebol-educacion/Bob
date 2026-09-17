'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Organization, getOrganizationForUser } from '@/lib/organization';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { resolveEnabledModes } from '@/lib/modes';
import { detectSustainedImprovementAction } from '@/actions/skills';
import { getPendingAssessmentsAction, type PendingAssessmentsMap } from '@/actions/assessment';
import { loadOrganizationData } from '@/lib/organization/load-organization';
import { mapSkillLevelRows, type RawSkillLevelRow } from '@/lib/organization/skill-levels';
import { computeEnabledModes } from '@/lib/organization/enabled-modes';
import type { AvailableMode, BobAccessDenialReason } from '@/lib/organization/types';
import type { ModeKey, ModeFramework, CefrLevel, DynamicCard, ResolvedCard } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';

export type { AvailableMode, BobAccessDenialReason };

interface OrganizationContextValue {
  organization: Organization | null;
  loading: boolean;
  enabledModes: ModeKey[];
  availableModes: AvailableMode[];
  allDynamicCards: DynamicCard[];
  skillLevels: SkillLevelMap | null;
  refreshSkillLevels: () => Promise<void>;
  refreshPendingAssessments: () => Promise<void>;
  selectedSkill: Skill | null;
  setSelectedSkill: (skill: Skill | null) => void;
  resolvedCards: ResolvedCard[];
  assessmentCooldownDays: number;
  pendingAssessments: PendingAssessmentsMap;
  sustainedImprovementDetected: boolean | null;
  checkSustainedImprovement: () => void;
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
  setCefrActiveLevel: (level: CefrLevel | null) => Promise<void>;
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
  skillLevels: null,
  refreshSkillLevels: async () => {},
  refreshPendingAssessments: async () => {},
  selectedSkill: null,
  setSelectedSkill: () => {},
  resolvedCards: [],
  assessmentCooldownDays: 7,
  pendingAssessments: { speaking: null, listening: null, reading: null, writing: null },
  sustainedImprovementDetected: null,
  checkSustainedImprovement: () => {},
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
  const [skillLevels, setSkillLevels] = useState<SkillLevelMap | null>(null);
  const [assessmentCooldownDays, setAssessmentCooldownDays] = useState<number>(7);
  const [pendingAssessments, setPendingAssessments] = useState<PendingAssessmentsMap>({
    speaking: null, listening: null, reading: null, writing: null,
  });
  const [selectedSkill, setSelectedSkillState] = useState<Skill | null>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('bob_selected_skill') as Skill | null) ?? null;
    }
    return null;
  });
  const [sustainedImprovementDetected, setSustainedImprovementDetected] = useState<boolean | null>(null);
  const improvementCheckedForRef = useRef<string | null>(null);

  const setSelectedSkill = useCallback((skill: Skill | null) => {
    setSelectedSkillState(skill);
    if (typeof window !== 'undefined') {
      if (skill === null) {
        sessionStorage.removeItem('bob_selected_skill');
      } else {
        sessionStorage.setItem('bob_selected_skill', skill);
      }
    }
  }, []);

  const [cachedOrg, setCachedOrg] = useState<Organization | null>(null);
  const [cachedStudentFrameworks, setCachedStudentFrameworks] = useState<ModeFramework[]>([]);
  const [cachedOrgFrameworks, setCachedOrgFrameworks] = useState<ModeFramework[]>([]);
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    (async () => {
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

        const bundle = await loadOrganizationData(supabase, userId, org);
        setCefrActiveLevelState(bundle.activeLevel);
        setCefrLevelLocked(bundle.levelLocked);
        setUserRole(bundle.role);
        setCachedUserId(userId);
        setSkillLevels(bundle.skillLevels);
        setAssessmentCooldownDays(bundle.assessmentCooldownDays);
        setAccessDenialReason(bundle.accessDenialReason);
        setCachedStudentFrameworks(bundle.studentFrameworks);
        setCachedOrgFrameworks(bundle.orgFrameworks);
        setAllDynamicCards(bundle.allDynamicCards);
        setEnabledModes(bundle.enabledModes);
        setAvailableModes(bundle.availableModes);
        void getPendingAssessmentsAction().then(setPendingAssessments);
      } catch (err) {
        console.error('[OrganizationContext] Unexpected error loading org data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let userId: string | null = null;

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;

      const refreshAll = () => {
        void getPendingAssessmentsAction().then(setPendingAssessments);
        void (async () => {
          const { data: rows } = await supabase
            .from('skill_levels')
            .select('skill, cefr_level, origin, confidence, last_assessment_at, updated_at')
            .eq('user_id', userId!);
          setSkillLevels(mapSkillLevelRows((rows ?? []) as RawSkillLevelRow[]));
        })();
      };

      const channel = supabase
        .channel('bob_assessment_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bob_skill_levels', filter: `user_id=eq.${userId}` },
          refreshAll
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bob_assessment_queue', filter: `user_id=eq.${userId}` },
          refreshAll
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    });
  }, []);

  const setCefrActiveLevel = useCallback(async (level: CefrLevel | null) => {
    if (cefrLevelLocked) {
      throw new Error('Tu colegio bloqueó tu nivel CEFR y no puede cambiarse.');
    }

    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado.');

    const { error } = await supabase
      .schema('public').from('profiles')
      .update({ cefr_active_level: level })
      .eq('id', user.id);

    if (error) {
      console.error('[OrganizationContext] setCefrActiveLevel failed:', error);
      throw new Error(error.message);
    }

    setCefrActiveLevelState(level);

    const isBobEnabled = cachedOrg?.is_bob_enabled ?? true;
    const effectiveFrameworks = cachedStudentFrameworks.filter(f => cachedOrgFrameworks.includes(f));
    const newModes = computeEnabledModes({
      isBobEnabled,
      cards: allDynamicCards,
      activeLevel: level,
      effectiveFrameworks,
      hasAssignedFrameworks: effectiveFrameworks.length > 0,
    });
    setEnabledModes(newModes);
  }, [cefrLevelLocked, cachedOrg, cachedStudentFrameworks, cachedOrgFrameworks, allDynamicCards]);

  const refreshSkillLevels = useCallback(async () => {
    if (!cachedUserId) return;
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from('skill_levels')
      .select('skill, cefr_level, origin, confidence, last_assessment_at, updated_at')
      .eq('user_id', cachedUserId);
    if (error) {
      console.error('[OrganizationContext] refreshSkillLevels failed:', error);
      return;
    }
    setSkillLevels(mapSkillLevelRows((data ?? []) as RawSkillLevelRow[]));
  }, [cachedUserId]);

  const refreshPendingAssessments = useCallback(async () => {
    const data = await getPendingAssessmentsAction();
    setPendingAssessments(data);
  }, []);

  const checkSustainedImprovement = useCallback(() => {
    if (!selectedSkill) return;
    const cacheKey = selectedSkill;
    if (improvementCheckedForRef.current === cacheKey) return;
    improvementCheckedForRef.current = cacheKey;
    setSustainedImprovementDetected(null);
    void detectSustainedImprovementAction(selectedSkill).then((result) => {
      setSustainedImprovementDetected(result);
    });
  }, [selectedSkill]);

  const resolvedCards = useMemo<ResolvedCard[]>(() => {
    if (!selectedSkill || !skillLevels) return [];
    return resolveEnabledModes({
      isBobEnabled: cachedOrg?.is_bob_enabled ?? false,
      selectedSkill,
      skillLevels,
      studentFrameworks: cachedStudentFrameworks,
      orgFrameworks: cachedOrgFrameworks,
      allDynamicCards,
    });
  }, [selectedSkill, skillLevels, cachedOrg, cachedStudentFrameworks, cachedOrgFrameworks, allDynamicCards]);

  const accessGranted = accessDenialReason === null && !loading;

  return (
    <OrganizationContext.Provider value={{
      organization,
      loading,
      enabledModes,
      availableModes,
      allDynamicCards,
      skillLevels,
      refreshSkillLevels,
      refreshPendingAssessments,
      selectedSkill,
      setSelectedSkill,
      resolvedCards,
      assessmentCooldownDays,
      pendingAssessments,
      sustainedImprovementDetected,
      checkSustainedImprovement,
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
