'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Organization, getOrganizationForUser } from '@/lib/organization';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { resolveEnabledModes } from '@/lib/modes';
import { hasFreePracticeCards } from '@/lib/free-practice';
import { detectSustainedImprovementAction } from '@/actions/skills';
import {
  getAssessmentQueueStatusAction,
  type AssessmentQueueStatus,
  type FailedAssessmentsMap,
  type PendingAssessmentsMap,
} from '@/actions/assessment';
import { emptyAssessmentQueueStatus } from '@/lib/assessment/queue-status';
import { loadOrganizationData } from '@/lib/organization/load-organization';
import { mapSkillLevelRows, type RawSkillLevelRow } from '@/lib/organization/skill-levels';
import { computeEnabledModes } from '@/lib/organization/enabled-modes';
import type { AvailableMode, BobAccessDenialReason } from '@/lib/organization/types';
import type { ModeKey, ModeFramework, CefrLevel, DynamicCard, ResolvedCard } from '@/lib/types/practice';
import type { PracticeTrack } from '@/lib/modes';
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
  track: PracticeTrack;
  setTrack: (track: PracticeTrack) => void;
  freeTrackAvailable: boolean;
  assessmentCooldownDays: number;
  pendingAssessments: PendingAssessmentsMap;
  failedAssessments: FailedAssessmentsMap;
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
  track: 'official',
  freeTrackAvailable: false,
  setTrack: () => {},
  assessmentCooldownDays: 7,
  pendingAssessments: emptyAssessmentQueueStatus().pending,
  failedAssessments: emptyAssessmentQueueStatus().failed,
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
  const [assessmentQueueStatus, setAssessmentQueueStatus] = useState<AssessmentQueueStatus>(emptyAssessmentQueueStatus);
  const [track, setTrack] = useState<PracticeTrack>('official');
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
        setCachedOrgFrameworks(bundle.orgFrameworks);
        setAllDynamicCards(bundle.allDynamicCards);
        setEnabledModes(bundle.enabledModes);
        setAvailableModes(bundle.availableModes);
        void getAssessmentQueueStatusAction().then(setAssessmentQueueStatus);
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId || disposed) return;

      const refreshAll = () => {
        void getAssessmentQueueStatusAction().then(setAssessmentQueueStatus);
        void (async () => {
          const { data: rows } = await supabase
            .from('skill_levels')
            .select('skill, cefr_level, origin, confidence, last_assessment_at, updated_at')
            .eq('user_id', userId!);
          setSkillLevels(mapSkillLevelRows((rows ?? []) as RawSkillLevelRow[]));
        })();
      };

      channel = supabase
        .channel('bob_assessment_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'bob', table: 'skill_levels', filter: `user_id=eq.${userId}` },
          refreshAll
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'bob', table: 'assessment_queue', filter: `user_id=eq.${userId}` },
          refreshAll
        )
        .subscribe();
    });

    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
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
    const newModes = computeEnabledModes({
      isBobEnabled,
      cards: allDynamicCards,
      activeLevel: level,
      effectiveFrameworks: cachedOrgFrameworks,
      hasAssignedFrameworks: cachedOrgFrameworks.length > 0,
    });
    setEnabledModes(newModes);
  }, [cefrLevelLocked, cachedOrg, cachedOrgFrameworks, allDynamicCards]);

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
    setAssessmentQueueStatus(await getAssessmentQueueStatusAction());
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

  const freeTrackAvailable = useMemo(() => {
    const level = (selectedSkill ? skillLevels?.[selectedSkill]?.cefr_level : null) ?? cefrActiveLevel;
    return hasFreePracticeCards(allDynamicCards, selectedSkill, level);
  }, [allDynamicCards, selectedSkill, skillLevels, cefrActiveLevel]);

  const effectiveTrack: PracticeTrack = freeTrackAvailable ? track : 'official';

  const resolvedCards = useMemo<ResolvedCard[]>(() => {
    if (!selectedSkill || !skillLevels) return [];
    return resolveEnabledModes({
      isBobEnabled: cachedOrg?.is_bob_enabled ?? false,
      selectedSkill,
      skillLevels,
      orgFrameworks: cachedOrgFrameworks,
      allDynamicCards,
      track: effectiveTrack,
    });
  }, [selectedSkill, skillLevels, cachedOrg, cachedOrgFrameworks, allDynamicCards, effectiveTrack]);

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
      track: effectiveTrack,
      setTrack,
      freeTrackAvailable,
      assessmentCooldownDays,
      pendingAssessments: assessmentQueueStatus.pending,
      failedAssessments: assessmentQueueStatus.failed,
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
