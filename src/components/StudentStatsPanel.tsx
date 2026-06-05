'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { useTranslations } from 'next-intl';
import {
  getStudentStatsAction,
  type StudentStatRow,
  type StudentStatsResult,
} from '@/actions/stats';
import { useOrganization } from '@/hooks/useOrganization';
import { SkillPath, type SkillPathSkill } from './SkillPath';

interface Props {
  onBack: () => void;
  onAfterReset: () => void;
  onTakeAssessment?: (skill: Skill) => void;
  onChangeLevel?: (skill: Skill, level: string) => Promise<void> | void;
}

const PICKABLE_LEVELS = ['pre_a1', 'a1', 'a2', 'b1', 'b2'] as const;
const LEVEL_LABEL: Record<string, string> = {
  pre_a1: 'Pre-A1',
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
};

type Skill = 'speaking' | 'reading' | 'listening' | 'writing';

const MODE_LABEL: Record<string, string> = {
  cambridge_starters_part1: 'Point to the picture',
  cambridge_starters_part2: 'Scene questions',
  cambridge_starters_part3: 'Story',
  cambridge_starters_part4: 'Personal questions',
  cambridge_movers_part1: 'Spot the differences',
  cambridge_movers_part2: 'Information exchange',
  cambridge_movers_part3: 'Picture story',
  cambridge_movers_part4: 'Personal questions',
  cambridge_movers_part5: 'Picture description',
  cambridge_ket_part1: 'Part 1',
  cambridge_pet_p3: 'Collaborative Task',
  cambridge_fce_p1: 'Speaking',
  toefl_listen_repeat: 'TOEFL · Listen & Repeat',
  toefl_interview: 'TOEFL · Take an Interview',
  generic_conversation: 'Free Practice · Conversation',
  generic_situation: 'Free Practice · Situations',
  generic_image: 'Free Practice · Picture',
};

const SKILL_META: Record<Skill, { color: string; soft: string; ring: string }> = {
  speaking: { color: '#3660AB', soft: '#dde4f2', ring: 'shadow-blue-200' },
  reading: { color: '#469E7B', soft: '#dcebe3', ring: 'shadow-emerald-200' },
  listening: { color: '#F8AC37', soft: '#fde9c8', ring: 'shadow-amber-200' },
  writing: { color: '#9333EA', soft: '#f3e8ff', ring: 'shadow-purple-200' },
};

const SKILL_LABEL_KEY: Record<Skill, string> = {
  speaking: 'skillSpeaking',
  reading: 'skillReading',
  listening: 'skillListening',
  writing: 'skillWriting',
};

function nextLevelLabel(current: string): string {
  const i = PICKABLE_LEVELS.indexOf(current as (typeof PICKABLE_LEVELS)[number]);
  if (i < 0) return LEVEL_LABEL[current] ?? current;
  const next = PICKABLE_LEVELS[Math.min(i + 1, PICKABLE_LEVELS.length - 1)];
  return LEVEL_LABEL[next] ?? next;
}

const MODE_SKILL_OVERRIDE: Record<string, Skill> = {
  cambridge_starters_part1: 'listening',
  toefl_listen_repeat: 'speaking',
};

function inferSkill(mode: string): Skill {
  const override = MODE_SKILL_OVERRIDE[mode];
  if (override) return override;
  if (mode.includes('listening')) return 'listening';
  if (mode.includes('reading')) return 'reading';
  if (mode.includes('writing')) return 'writing';
  return 'speaking';
}

function inferLevel(mode: string): string {
  if (mode.includes('starters')) return 'Pre-A1';
  if (mode.includes('movers')) return 'A1';
  if (mode.includes('flyers')) return 'A2';
  if (mode.includes('ket')) return 'A2';
  if (mode.includes('pet')) return 'B1';
  if (mode.includes('fce')) return 'B2';
  if (mode.includes('cae')) return 'C1';
  if (mode.includes('cpe')) return 'C2';
  if (mode.startsWith('toefl')) return 'TOEFL';
  return 'Free';
}

function inferFramework(mode: string): string {
  if (mode.startsWith('cambridge_')) return 'English';
  if (mode.startsWith('toefl_')) return 'TOEFL';
  return 'Free';
}

function partOrder(mode: string): number {
  const m = mode.match(/part[_-]?(\d+)|p(\d+)/i);
  if (m) return Number(m[1] ?? m[2]);
  if (mode.includes('listen_repeat')) return 1;
  if (mode.includes('interview')) return 2;
  return 99;
}

function starsFor(pct: number): 0 | 1 | 2 | 3 {
  if (pct >= 80) return 3;
  if (pct >= 60) return 2;
  if (pct >= 40) return 1;
  return 0;
}

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

type LastAssessment = { cefr_band: string; occurred_at: string };

interface PathNode {
  mode: string;
  label: string;
  framework: string;
  level: string;
  skill: Skill;
  pct: number;
  stars: 0 | 1 | 2 | 3;
  sessions: number;
  last_done: string;
  order: number;
}

interface Derived {
  streak: number;
  totalXp: number;
  goldBadges: number;
  totalStars: number;
  bySkill: Record<Skill, { pct: number; sessions: number }>;
  groups: Array<{ key: string; title: string; framework: string; level: string; nodes: PathNode[] }>;
}

function deriveStats(stats: StudentStatsResult): Derived {
  const streak = calcStreak(stats.session_dates);
  let totalXp = 0;
  let goldBadges = 0;
  let totalStars = 0;
  const skillAgg: Record<Skill, { sum: number; max: number; sessions: number }> = {
    speaking: { sum: 0, max: 0, sessions: 0 },
    reading: { sum: 0, max: 0, sessions: 0 },
    listening: { sum: 0, max: 0, sessions: 0 },
    writing: { sum: 0, max: 0, sessions: 0 },
  };
  const nodes: PathNode[] = stats.rows.map<PathNode>((r: StudentStatRow) => {
    const pct = r.score_max > 0 ? (r.avg_score / r.score_max) * 100 : 0;
    const stars = starsFor(pct);
    const skill = inferSkill(r.mode);
    totalXp += Math.round(r.avg_score * r.sessions_count);
    if (pct >= 80) goldBadges++;
    totalStars += stars;
    skillAgg[skill].sum += r.avg_score * r.sessions_count;
    skillAgg[skill].max += r.score_max * r.sessions_count;
    skillAgg[skill].sessions += r.sessions_count;
    return {
      mode: r.mode,
      label: MODE_LABEL[r.mode] ?? r.mode,
      framework: inferFramework(r.mode),
      level: inferLevel(r.mode),
      skill,
      pct,
      stars,
      sessions: r.sessions_count,
      last_done: r.last_done,
      order: partOrder(r.mode),
    };
  });

  const bySkill: Record<Skill, { pct: number; sessions: number }> = {
    speaking: {
      pct: skillAgg.speaking.max > 0 ? (skillAgg.speaking.sum / skillAgg.speaking.max) * 100 : 0,
      sessions: skillAgg.speaking.sessions,
    },
    reading: {
      pct: skillAgg.reading.max > 0 ? (skillAgg.reading.sum / skillAgg.reading.max) * 100 : 0,
      sessions: skillAgg.reading.sessions,
    },
    listening: {
      pct: skillAgg.listening.max > 0 ? (skillAgg.listening.sum / skillAgg.listening.max) * 100 : 0,
      sessions: skillAgg.listening.sessions,
    },
    writing: {
      pct: skillAgg.writing.max > 0 ? (skillAgg.writing.sum / skillAgg.writing.max) * 100 : 0,
      sessions: skillAgg.writing.sessions,
    },
  };

  const grouped = new Map<string, { title: string; framework: string; level: string; nodes: PathNode[] }>();
  for (const n of nodes) {
    const key = `${n.framework}::${n.level}`;
    if (!grouped.has(key)) {
      grouped.set(key, { title: n.level, framework: n.framework, level: n.level, nodes: [] });
    }
    grouped.get(key)!.nodes.push(n);
  }
  const groups = Array.from(grouped.entries()).map(([key, g]) => ({
    key,
    ...g,
    nodes: g.nodes.slice().sort((a, b) => a.order - b.order),
  }));

  return { streak, totalXp, goldBadges, totalStars, bySkill, groups };
}

export function StudentStatsPanel({ onBack, onTakeAssessment, onChangeLevel }: Props) {
  const t = useTranslations('dashboard');
  const { skillLevels, pendingAssessments } = useOrganization();
  const [stats, setStats] = useState<StudentStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAssessments, setLastAssessments] = useState<Record<Skill, LastAssessment | null>>({
    speaking: null, reading: null, listening: null, writing: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStudentStatsAction();
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('bob_skill_level_history')
        .select('skill, new_level, occurred_at')
        .eq('user_id', user.id)
        .eq('origin', 'assessment')
        .order('occurred_at', { ascending: false });
      if (!data) return;
      const byMostRecent: Record<Skill, LastAssessment | null> = {
        speaking: null, reading: null, listening: null, writing: null,
      };
      for (const row of data) {
        const s = row.skill as Skill;
        if (!byMostRecent[s]) {
          byMostRecent[s] = { cefr_band: row.new_level, occurred_at: row.occurred_at };
        }
      }
      setLastAssessments(byMostRecent);
    })();
  }, []);

  const derived = useMemo(() => (stats ? deriveStats(stats) : null), [stats]);

  const greeting = useMemo(() => {
    if (!derived || !stats) return '';
    if (derived.streak >= 7) return t('greetingLegend', { n: derived.streak });
    if (derived.streak >= 3) return t('greetingStreak', { n: derived.streak });
    if (derived.streak === 1) return t('greetingDay1');
    if (stats.total_sessions > 0) return t('greetingWelcomeBack');
    return t('greetingFirst');
  }, [derived, stats, t]);

  const hasData = !!stats && stats.total_sessions > 0 && !!derived;

  const pathSkills = useMemo<SkillPathSkill[]>(() => {
    if (!derived) return [];
    return (['speaking', 'reading', 'listening', 'writing'] as Skill[]).map((skill) => {
      const current = skillLevels?.[skill]?.cefr_level ?? null;
      const stat = derived.bySkill[skill];
      const la = lastAssessments[skill];
      return {
        key: skill,
        label: t(SKILL_LABEL_KEY[skill]),
        level: current ? LEVEL_LABEL[current] ?? current : '—',
        goalLevel: nextLevelLabel(current ?? 'a1'),
        cefrValue: current,
        done: stat.sessions,
        total: Math.max(30, stat.sessions + 4),
        pct: stat.pct,
        sessions: stat.sessions,
        lastTest: la ? `${la.cefr_band.replace('_', ' ')} · ${relativeTime(la.occurred_at)}` : null,
        pending: !!pendingAssessments[skill],
      };
    });
  }, [derived, skillLevels, lastAssessments, pendingAssessments, t]);

  const pickableLevels = useMemo(
    () => PICKABLE_LEVELS.map((value) => ({ value, label: LEVEL_LABEL[value] })),
    [],
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

        {stats && derived && pathSkills.length > 0 && (
          <SkillPath
            skills={pathSkills}
            title={t('pathTitle')}
            startLabel={t('pathStart')}
            pickableLevels={pickableLevels}
            onTakeTest={onTakeAssessment}
            onChangeLevel={onChangeLevel}
          />
        )}
      </div>
    </div>
  );
}
