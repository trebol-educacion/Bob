'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  BarChart3,
  Flame,
  Lock,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Trophy,
} from 'lucide-react';
import {
  getStudentStatsAction,
  resetStudentHistoryAction,
  type StudentStatRow,
  type StudentStatsResult,
} from '@/actions/stats';

interface Props {
  onBack: () => void;
  onAfterReset: () => void;
}

type Skill = 'speaking' | 'reading' | 'listening' | 'writing';

const MODE_LABEL: Record<string, string> = {
  cambridge_starters_part1: 'Starters · Point to the picture',
  cambridge_starters_part2: 'Starters · Scene questions',
  cambridge_starters_part3: 'Starters · Story',
  cambridge_starters_part4: 'Starters · Personal questions',
  cambridge_movers_part1: 'Movers · Spot the differences',
  cambridge_movers_part2: 'Movers · Information exchange',
  cambridge_movers_part3: 'Movers · Picture story',
  cambridge_movers_part4: 'Movers · Personal questions',
  cambridge_movers_part5: 'Movers · Picture description',
  cambridge_ket_part1: 'KET · Part 1',
  cambridge_pet_p3: 'PET · Collaborative Task',
  cambridge_fce_p1: 'FCE · Speaking',
  toefl_listen_repeat: 'TOEFL · Listen & Repeat',
  toefl_interview: 'TOEFL · Take an Interview',
  generic_conversation: 'Free Practice · Conversation',
  generic_situation: 'Free Practice · Situations',
  generic_image: 'Free Practice · Picture',
};

const SKILL_META: Record<Skill, { label: string; color: string; soft: string; ring: string }> = {
  speaking: { label: 'Hablar', color: '#3660AB', soft: '#dde4f2', ring: 'shadow-blue-200' },
  reading: { label: 'Leer', color: '#469E7B', soft: '#dcebe3', ring: 'shadow-emerald-200' },
  listening: { label: 'Escuchar', color: '#F8AC37', soft: '#fde9c8', ring: 'shadow-amber-200' },
  writing: { label: 'Escribir', color: '#E62D2B', soft: '#fad6d5', ring: 'shadow-rose-200' },
};

function inferSkill(mode: string): Skill {
  if (mode.includes('listen_repeat') || mode.includes('listening')) return 'listening';
  if (mode.includes('reading')) return 'reading';
  if (mode.includes('writing')) return 'writing';
  return 'speaking';
}

function inferLevel(mode: string): string {
  if (mode.includes('starters')) return 'A1 Starters';
  if (mode.includes('movers')) return 'A1 Movers';
  if (mode.includes('flyers')) return 'A2 Flyers';
  if (mode.includes('ket')) return 'A2 KET';
  if (mode.includes('pet')) return 'B1 PET';
  if (mode.includes('fce')) return 'B2 FCE';
  if (mode.includes('cae')) return 'C1 CAE';
  if (mode.includes('cpe')) return 'C2 CPE';
  if (mode.startsWith('toefl')) return 'TOEFL';
  return 'Free';
}

function inferFramework(mode: string): string {
  if (mode.startsWith('cambridge_')) return 'Cambridge';
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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
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

function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setN(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);
  return <>{n.toLocaleString()}</>;
}

function SkillRing({
  skill,
  pct,
  sessions,
  index,
}: {
  skill: Skill;
  pct: number;
  sessions: number;
  index: number;
}) {
  const meta = SKILL_META[skill];
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const active = sessions > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
      className="relative flex flex-col items-center gap-1.5"
    >
      <div className="relative">
        <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
          <circle
            cx="46"
            cy="46"
            r={radius}
            fill="none"
            stroke={meta.soft}
            strokeWidth="9"
          />
          <motion.circle
            cx="46"
            cy="46"
            r={radius}
            fill="none"
            stroke={meta.color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: active ? offset : circumference }}
            transition={{ delay: 0.4 + index * 0.07, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-xl font-black tabular-nums"
            style={{ color: active ? meta.color : '#cbd5e1' }}
          >
            {active ? Math.round(pct) : '—'}
          </span>
          {active && (
            <span className="text-[8px] font-bold uppercase tracking-widest text-trebol-text/40">
              prom
            </span>
          )}
        </div>
      </div>
      <span
        className="text-[11px] font-black uppercase tracking-wider"
        style={{ color: active ? meta.color : '#94a3b8' }}
      >
        {meta.label}
      </span>
      <span className="text-[10px] font-semibold text-trebol-text/40">
        {sessions} {sessions === 1 ? 'sesión' : 'sesiones'}
      </span>
    </motion.div>
  );
}

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

function PathNodeCard({ node, index }: { node: PathNode; index: number }) {
  const meta = SKILL_META[node.skill];
  const completed = node.pct >= 80;
  const inProgress = node.sessions > 0 && !completed;
  const side = index % 2 === 0 ? 'left' : 'right';

  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -24 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.08, type: 'spring', stiffness: 220, damping: 24 }}
      className={`relative flex items-center gap-4 ${
        side === 'left' ? 'justify-start' : 'justify-end flex-row-reverse'
      }`}
    >
      <div className="relative shrink-0">
        <motion.div
          whileHover={{ scale: 1.06, rotate: side === 'left' ? -3 : 3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="relative w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl shadow-lg"
          style={{
            background: completed
              ? `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`
              : inProgress
                ? `linear-gradient(135deg, #fff, ${meta.soft})`
                : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
            color: completed ? '#fff' : inProgress ? meta.color : '#94a3b8',
            border: inProgress ? `3px solid ${meta.color}` : '3px solid transparent',
            boxShadow: completed
              ? `0 10px 24px -8px ${meta.color}80, inset 0 -4px 0 0 ${meta.color}cc`
              : inProgress
                ? `0 6px 16px -4px ${meta.color}40`
                : '0 4px 10px -4px rgba(0,0,0,0.08), inset 0 -3px 0 0 #cbd5e1',
          }}
        >
          {completed ? (
            <Trophy size={28} strokeWidth={2.5} />
          ) : inProgress ? (
            <span className="tabular-nums">{node.order}</span>
          ) : (
            <Lock size={22} strokeWidth={2.5} />
          )}
        </motion.div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              size={12}
              strokeWidth={2}
              className={s <= node.stars ? 'fill-[#F8AC37] stroke-[#d98e1d]' : 'fill-white stroke-slate-300'}
            />
          ))}
        </div>
      </div>

      <div
        className={`flex-1 max-w-[260px] ${side === 'left' ? 'text-left' : 'text-right'}`}
      >
        <div className={`flex items-center gap-1.5 mb-1 ${side === 'right' ? 'justify-end' : ''}`}>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
            style={{ background: meta.soft, color: meta.color }}
          >
            {meta.label}
          </span>
          {node.sessions > 0 && (
            <span className="text-[10px] font-semibold text-trebol-text/40">
              {formatRelative(node.last_done)}
            </span>
          )}
        </div>
        <p className="text-sm font-black text-trebol-text leading-tight">{node.label}</p>
        {node.sessions > 0 ? (
          <p className="text-xs font-semibold text-trebol-text/50 mt-1">
            <span className="tabular-nums" style={{ color: meta.color }}>
              {Math.round(node.pct)}%
            </span>{' '}
            · {node.sessions} {node.sessions === 1 ? 'intento' : 'intentos'}
          </p>
        ) : (
          <p className="text-xs font-semibold text-trebol-text/30 mt-1 italic">Aún sin empezar</p>
        )}
      </div>
    </motion.div>
  );
}

function PathGroup({ title, level, framework, nodes }: { title: string; level: string; framework: string; nodes: PathNode[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      className="relative"
    >
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#fffbf2] via-[#fffbf2] to-transparent pt-2 pb-3 mb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-black text-trebol-text tracking-tight">{title}</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-trebol-text/5 text-trebol-text/60">
            {framework} · {level}
          </span>
        </div>
      </div>
      <div className="relative pl-2 pr-2">
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-[repeating-linear-gradient(to_bottom,#e2e8f0_0,#e2e8f0_6px,transparent_6px,transparent_12px)] rounded-full"
        />
        <div className="space-y-6 relative">
          {nodes.map((n, i) => (
            <PathNodeCard key={n.mode} node={n} index={i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function HeroChip({
  icon,
  label,
  value,
  bg,
  fg,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  bg: string;
  fg: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 18 }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-sm"
      style={{ background: bg, color: fg }}
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</span>
        <span className="text-xl font-black tabular-nums mt-0.5">{value}</span>
      </div>
    </motion.div>
  );
}

interface Derived {
  streak: number;
  totalXp: number;
  goldBadges: number;
  totalStars: number;
  bySkill: Record<Skill, { pct: number; sessions: number }>;
  groups: Array<{ key: string; title: string; framework: string; level: string; nodes: PathNode[] }>;
  greeting: string;
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

  const greeting =
    streak >= 7
      ? `¡${streak} días seguidos! Eres una leyenda 🔥`
      : streak >= 3
        ? `¡${streak} días seguidos! ¡Sigue así! 💪`
        : streak === 1
          ? '¡Buen comienzo! Vuelve mañana.'
          : stats.total_sessions > 0
            ? '¡Bienvenido otra vez! ¿List@ para practicar?'
            : '¡Bienvenido! Vamos a empezar tu aventura.';

  return { streak, totalXp, goldBadges, totalStars, bySkill, groups, greeting };
}

export function StudentStatsPanel({ onBack, onAfterReset }: Props) {
  const [stats, setStats] = useState<StudentStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const derived = useMemo(() => (stats ? deriveStats(stats) : null), [stats]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetStudentHistoryAction();
      setConfirmOpen(false);
      await load();
      onAfterReset();
    } catch (err) {
      console.error('[stats] reset failed:', err);
    } finally {
      setResetting(false);
    }
  };

  const hasData = !!stats && stats.total_sessions > 0 && !!derived;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#fffbf2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 14%, #fde9c8 0, transparent 38%), radial-gradient(circle at 88% 10%, #dde4f2 0, transparent 32%), radial-gradient(circle at 75% 88%, #dcebe3 0, transparent 36%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #1e293b 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

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
                Mi progreso
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F8AC37]/20 text-[#d98e1d] text-[9px] font-black uppercase tracking-widest">
                <Sparkles size={8} fill="#d98e1d" strokeWidth={0} />
                En vivo
              </span>
            </div>
            <p className="text-[11px] text-trebol-text/55 font-bold mt-0.5 leading-none truncate">
              Tu aventura con Bob
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
          style={{
            background:
              'linear-gradient(90deg, #3660AB 0%, #469E7B 30%, #F8AC37 60%, #E62D2B 100%)',
          }}
        />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
        {loading && !stats && (
          <div className="text-center text-sm text-trebol-text/50 py-20 font-semibold">
            Cargando tu aventura…
          </div>
        )}

        {!loading && stats && stats.total_sessions === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-16 px-6"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              className="relative w-32 h-32 mx-auto mb-6"
            >
              <Image
                src="/bob_avatar.png"
                alt="Bob"
                fill
                sizes="128px"
                className="object-contain drop-shadow-xl"
                priority
              />
            </motion.div>
            <h2 className="text-2xl font-black text-trebol-text mb-2 tracking-tight">
              ¡Aquí empieza tu aventura!
            </h2>
            <p className="text-sm text-trebol-text/60 font-semibold max-w-xs mx-auto">
              Elige una actividad y empieza a practicar. Aquí verás tus rachas, trofeos y todos los retos que vayas conquistando.
            </p>
          </motion.div>
        )}

        {hasData && derived && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden rounded-[28px] border-2 border-white shadow-xl mb-6"
              style={{
                background:
                  'linear-gradient(135deg, #3660AB 0%, #3f7a96 55%, #469E7B 100%)',
              }}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 80% 20%, #fff 0, transparent 30%), radial-gradient(circle at 20% 90%, #fff 0, transparent 25%)',
                }}
              />
              <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
                  className="relative shrink-0"
                >
                  <div
                    aria-hidden
                    className="absolute -inset-3 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, #fde68a, #fbcfe8, #c7d2fe, #fde68a)',
                      filter: 'blur(8px)',
                      opacity: 0.6,
                    }}
                  />
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
                    Bob dice
                  </motion.p>
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    className="text-xl sm:text-2xl font-black tracking-tight leading-tight"
                  >
                    {derived.greeting}
                  </motion.h2>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start"
                  >
                    <HeroChip
                      icon={<Flame size={18} fill="#fff" strokeWidth={0} />}
                      label="Racha"
                      value={<CountUp value={derived.streak} />}
                      bg="linear-gradient(135deg, #E62D2B, #b8201f)"
                      fg="#fff"
                      delay={0.4}
                    />
                    <HeroChip
                      icon={<Sparkles size={18} fill="#fffbe8" strokeWidth={1.5} className="text-white" />}
                      label="XP"
                      value={<CountUp value={derived.totalXp} />}
                      bg="linear-gradient(135deg, #F8AC37, #d98e1d)"
                      fg="#fff"
                      delay={0.5}
                    />
                    <HeroChip
                      icon={<Trophy size={18} strokeWidth={2.2} />}
                      label="Trofeos"
                      value={<CountUp value={derived.goldBadges} />}
                      bg="linear-gradient(135deg, #1E1E1C, #3a3a36)"
                      fg="#fff"
                      delay={0.6}
                    />
                  </motion.div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="relative bg-white/80 backdrop-blur-sm border border-white shadow-lg rounded-[28px] p-5 mb-6"
            >
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-base font-black text-trebol-text tracking-tight">Habilidades</h3>
                <div className="flex items-center gap-1 text-[#F8AC37]">
                  {Array.from({ length: Math.min(5, derived.totalStars) }).map((_, i) => (
                    <Star key={i} size={12} className="fill-[#F8AC37] stroke-[#d98e1d]" />
                  ))}
                  <span className="text-xs font-black tabular-nums text-trebol-text/60 ml-1">
                    {derived.totalStars}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['speaking', 'reading', 'listening', 'writing'] as Skill[]).map((skill, i) => (
                  <SkillRing
                    key={skill}
                    skill={skill}
                    pct={derived.bySkill[skill].pct}
                    sessions={derived.bySkill[skill].sessions}
                    index={i}
                  />
                ))}
              </div>
            </motion.section>

            <section className="space-y-8 pb-12">
              {derived.groups.map((g) => (
                <PathGroup
                  key={g.key}
                  title={g.title}
                  level={g.level}
                  framework={g.framework}
                  nodes={g.nodes}
                />
              ))}
            </section>

            <div className="flex justify-center pb-8">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full text-trebol-text/40 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={11} />
                Borrar historial
              </button>
            </div>
          </>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-trebol-text/40 backdrop-blur-sm flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-white"
          >
            <h3 className="text-lg font-black text-trebol-text tracking-tight">¿Borrar progreso?</h3>
            <p className="text-sm text-trebol-text/70 font-semibold leading-relaxed">
              Esto eliminará permanentemente todas tus sesiones y sus evaluaciones. No se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={resetting}
                className="px-4 py-2 rounded-xl text-sm font-black text-trebol-text/70 hover:bg-trebol-secondary/30 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 rounded-xl text-sm font-black bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2 shadow-md"
              >
                {resetting && <RefreshCw size={14} className="animate-spin" />}
                Sí, borrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
