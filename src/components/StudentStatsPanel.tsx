'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getStudentStatsAction } from '@/actions/stats';
import type { StudentStatsResult } from '@/lib/stats/progress-summary';
import {
  LEVEL_LABEL,
  LEVEL_ORDER,
  PICKABLE_LEVELS,
  deriveStats,
  nextLevelLabel,
  nextLevelValue,
  relativeTime,
} from '@/lib/stats/derive';
import { useOrganization } from '@/hooks/useOrganization';
import { SkillPath, type SkillPathSkill } from './SkillPath';
import { ProgressOverview, type OverviewSkill } from './ProgressOverview';
import { ChallengeAttemptsList } from './challenge/ChallengeAttemptsList';

interface Props {
  onBack: () => void;
  onAfterReset: () => void;
  onTakeAssessment?: (skill: Skill) => void;
  onChangeLevel?: (skill: Skill, level: string) => Promise<void> | void;
  onLevelUp?: (skill: Skill, level: string) => Promise<void> | void;
  onOpenChallenge?: () => void;
}

const DEFAULT_ACTIVITY_TARGET = 10;
type Skill = 'speaking' | 'reading' | 'listening' | 'writing';

const SKILL_LABEL_KEY: Record<Skill, string> = {
  speaking: 'skillSpeaking',
  reading: 'skillReading',
  listening: 'skillListening',
  writing: 'skillWriting',
};

export function StudentStatsPanel({ onBack, onTakeAssessment, onChangeLevel, onLevelUp, onOpenChallenge }: Props) {
  const t = useTranslations('dashboard');
  const { skillLevels, pendingAssessments } = useOrganization();
  const [stats, setStats] = useState<StudentStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getStudentStatsAction());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const derived = useMemo(() => (stats ? deriveStats(stats) : null), [stats]);

  const greeting = useMemo(() => {
    if (!derived || !stats) return '';
    if (derived.streak >= 7) return t('greetingLegend', { n: derived.streak });
    if (derived.streak >= 3) return t('greetingStreak', { n: derived.streak });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const hasPriorActivity = stats.session_dates.some((d) => new Date(d) < startOfToday);
    if (!hasPriorActivity) return t('greetingFirst');
    if (derived.streak === 1) return t('greetingDay1');
    return t('greetingWelcomeBack');
  }, [derived, stats, t]);

  const hasData = !!stats && stats.total_sessions > 0 && !!derived;

  const pathSkills = useMemo<SkillPathSkill[]>(() => {
    if (!derived) return [];
    return (['speaking', 'reading', 'listening', 'writing'] as Skill[]).map((skill) => {
      const current = skillLevels?.[skill]?.cefr_level ?? null;
      const currentLabel = current ? LEVEL_LABEL[current] ?? current : null;
      const stat = (currentLabel && derived.bySkillLevel[skill]?.[currentLabel]) || { pct: 0, sessions: 0 };
      const la = stats?.last_tests[skill] ?? null;
      const target = (current && stats?.targets[skill]?.[current]) || DEFAULT_ACTIVITY_TARGET;
      const curOrder = currentLabel ? LEVEL_ORDER[currentLabel] ?? -1 : -1;
      const history = curOrder > 0
        ? Object.entries(derived.activitiesByLevel[skill])
            .filter(([level, acts]) => acts.length > 0 && (LEVEL_ORDER[level] ?? -1) >= 0 && (LEVEL_ORDER[level] ?? -1) < curOrder)
            .sort((a, b) => (LEVEL_ORDER[a[0]] ?? 0) - (LEVEL_ORDER[b[0]] ?? 0))
            .map(([level, acts]) => ({
              level,
              avg10: (derived.bySkillLevel[skill]?.[level]?.pct ?? 0) / 10,
              activities: acts.map((a) => ({ label: a.label, score10: a.score10, when: relativeTime(a.created_at) })),
            }))
        : [];
      return {
        key: skill,
        label: t(SKILL_LABEL_KEY[skill]),
        level: currentLabel ?? '-',
        goalLevel: current ? nextLevelLabel(current) : null,
        cefrValue: current,
        done: Math.min(stat.sessions, target),
        total: target,
        pct: stat.pct,
        sessions: stat.sessions,
        lastTest: la ? `${la.cefr_band.replace('_', ' ')} · ${relativeTime(la.occurred_at)}` : null,
        pending: !!pendingAssessments[skill],
        history,
      };
    });
  }, [derived, stats, skillLevels, pendingAssessments, t]);

  const pickableLevels = useMemo(
    () => PICKABLE_LEVELS.map((value) => ({ value, label: LEVEL_LABEL[value] })),
    [],
  );

  const overviewSkills = useMemo<OverviewSkill[]>(
    () =>
      pathSkills.map((s) => ({
        key: s.key,
        label: s.label,
        cefr: s.cefrValue,
        done: s.done,
        total: s.total,
        pct: s.pct,
        sessions: s.sessions,
      })),
    [pathSkills],
  );

  const levelsCompleted = useMemo(
    () => pathSkills.reduce((sum, s) => sum + (s.history?.length ?? 0), 0),
    [pathSkills],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-white">
      <div className="relative z-10 shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 bg-white/75 backdrop-blur-md">
          <button
            onClick={onBack}
            className="group relative p-2 rounded-xl bg-white border border-trebol-border/60 hover:border-[#3660AB] hover:bg-[#dde4f2] transition-all shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-trebol-text group-hover:text-[#3660AB] group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black text-trebol-text tracking-tight leading-none">
                {t('myProgress')}
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F8AC37]/20 text-[#d98e1d] text-[9px] font-black uppercase tracking-widest">
                <Sparkles size={8} fill="#d98e1d" strokeWidth={0} />
                {t('live')}
              </span>
            </div>
            <p className="text-[11px] text-trebol-text/55 font-bold mt-0.5 leading-none truncate">
              {t('yourJourney')}
            </p>
          </div>

          {onOpenChallenge && (
            <button
              onClick={onOpenChallenge}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-white text-xs font-black shadow-md hover:brightness-105 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #3660AB, #F8AC37)' }}
              aria-label="Open Challenge"
            >
              <Trophy size={15} strokeWidth={2.5} fill="currentColor" />
              <span className="hidden sm:inline">Challenge</span>
            </button>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-trebol-border/60 hover:border-[#469E7B] hover:bg-[#dcebe3] transition-all disabled:opacity-50 shadow-sm group"
            aria-label="Refresh"
          >
            <RefreshCw size={16} strokeWidth={2.5} className={`text-trebol-text/70 group-hover:text-[#469E7B] transition-colors ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div
          aria-hidden
          className="h-[3px] w-full"
          style={{ background: 'var(--color-bob-brand)' }}
        />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
        {loading && !stats && (
          <div className="text-center text-sm text-trebol-text/50 py-20 font-semibold">
            {t('loadingAdventure')}
          </div>
        )}

        {!loading && stats && stats.total_sessions === 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center py-10 px-6"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                className="relative w-28 h-28 mx-auto mb-5"
              >
                <Image
                  src="/bob_avatar.png"
                  alt="Bob"
                  fill
                  sizes="112px"
                  className="object-contain drop-shadow-xl"
                  priority
                />
              </motion.div>
              <h2 className="text-2xl font-black text-trebol-text mb-2 tracking-tight">
                {t('emptyTitle')}
              </h2>
              <p className="text-sm text-trebol-text/60 font-semibold max-w-xs mx-auto">
                {t('emptyBody')}
              </p>
            </motion.div>
          </>
        )}

        {hasData && derived && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden rounded-[28px] shadow-xl mb-6"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
                  className="relative shrink-0"
                >
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white shadow-2xl ring-4 ring-white overflow-hidden">
                    <motion.div
                      animate={{ rotate: [0, -6, 6, -4, 0] }}
                      transition={{ delay: 0.6, duration: 1.4, ease: 'easeInOut' }}
                      className="w-full h-full relative"
                      style={{ transformOrigin: '50% 80%' }}
                    >
                      <Image
                        src="/bob_avatar.png"
                        alt="Bob"
                        fill
                        sizes="112px"
                        className="object-cover"
                        priority
                      />
                    </motion.div>
                  </div>
                </motion.div>

                <div className="flex-1 text-center sm:text-left text-white">
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70 mb-1"
                  >
                    {t('bobSays')}
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    className="text-xl sm:text-2xl font-black tracking-tight leading-tight"
                  >
                    {greeting}
                  </motion.h2>
                </div>
              </div>
            </motion.section>
          </>
        )}
        </div>

        <ChallengeAttemptsList />

        {hasData && derived && (
          <ProgressOverview
            sessionDates={stats!.session_dates}
            totalStars={derived.totalStars}
            goldBadges={derived.goldBadges}
            levelsCompleted={levelsCompleted}
            skills={overviewSkills}
          />
        )}

        {stats && derived && pathSkills.length > 0 && (
          <SkillPath
            skills={pathSkills}
            title={t('pathTitle')}
            startLabel={t('pathStart')}
            pickableLevels={pickableLevels}
            onTakeTest={onTakeAssessment}
            onChangeLevel={onChangeLevel}
            onLevelUp={
              onLevelUp
                ? async (skill) => {
                    const current = skillLevels?.[skill]?.cefr_level ?? 'a1';
                    const next = nextLevelValue(current);
                    if (next === current) return;
                    await onLevelUp(skill, next);
                    await load();
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
