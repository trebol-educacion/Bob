'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  GraduationCap,
  Headphones,
  Mic,
  PenLine,
  Star,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type SkillKey = 'speaking' | 'reading' | 'listening' | 'writing';

/** One skill row for the compact "Progress by skill" block. */
export interface OverviewSkill {
  key: SkillKey;
  label: string;
  cefr: string | null;
  done: number;
  total: number;
  pct: number;
  sessions: number;
}

/** Pre-derived, real student data consumed by {@link ProgressOverview}. */
export interface ProgressOverviewProps {
  sessionDates: string[];
  totalStars: number;
  goldBadges: number;
  levelsCompleted: number;
  skills: OverviewSkill[];
}

type Range = 'week' | 'month' | 'year';

interface Bucket {
  label: string;
  value: number;
}

const PALETTE: Record<SkillKey, { c: string; light: string; soft: string }> = {
  speaking: { c: '#3660AB', light: '#7aa0ff', soft: '#dde4f2' },
  reading: { c: '#469E7B', light: '#7fd0ad', soft: '#dcebe3' },
  listening: { c: '#F8AC37', light: '#ffce7a', soft: '#fde9c8' },
  writing: { c: '#9333EA', light: '#c084fc', soft: '#ede0fb' },
};

const ICON: Record<SkillKey, typeof Mic> = {
  speaking: Mic,
  reading: BookOpen,
  listening: Headphones,
  writing: PenLine,
};

const AMBER = '#F8AC37';
const AMBER_LIGHT = '#ffce7a';
const AMBER_DARK = '#d98e1d';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Counts activities per ISO weekday (Mon→Sun) for the current calendar week. */
function bucketByCurrentWeek(dates: string[]): Bucket[] {
  const today = startOfDay(new Date());
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayIndex(today));
  const counts = new Array(7).fill(0);
  for (const iso of dates) {
    const d = startOfDay(new Date(iso));
    const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) counts[diff] += 1;
  }
  return WEEKDAY_LABELS.map((label, i) => ({ label, value: counts[i] }));
}

/** Counts activities per day for the last 7 calendar days ending today. */
function bucketByLast7Days(dates: string[]): Bucket[] {
  const today = startOfDay(new Date());
  const buckets: Bucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    buckets.push({ label: WEEKDAY_LABELS[mondayIndex(day)], value: 0 });
  }
  for (const iso of dates) {
    const d = startOfDay(new Date(iso));
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) buckets[6 - diff].value += 1;
  }
  return buckets;
}

/** Counts activities per day for the last 30 calendar days, sampled every 5 days for labels. */
function bucketByLast30Days(dates: string[]): Bucket[] {
  const today = startOfDay(new Date());
  const buckets: Bucket[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const show = i % 5 === 0;
    buckets.push({ label: show ? `${day.getDate()}` : '', value: 0 });
  }
  for (const iso of dates) {
    const d = startOfDay(new Date(iso));
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < 30) buckets[29 - diff].value += 1;
  }
  return buckets;
}

/** Counts activities per calendar month over the last 12 months ending this month. */
function bucketByLast12Months(dates: string[]): Bucket[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const buckets: Bucket[] = [];
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
    buckets.push({ label: MONTH_LABELS[m.getMonth()], value: 0 });
    keys.push(`${m.getFullYear()}-${m.getMonth()}`);
  }
  const index = new Map(keys.map((k, i) => [k, i]));
  for (const iso of dates) {
    const d = new Date(iso);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = index.get(k);
    if (i !== undefined) buckets[i].value += 1;
  }
  return buckets;
}

const BAR_LABEL_HEADROOM = 34;

function BarChart({ buckets, height }: { buckets: Bucket[]; height: number }) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const barsArea = Math.max(32, height - BAR_LABEL_HEADROOM);
  return (
    <div className="flex items-end gap-1 sm:gap-1.5">
      {buckets.map((b, i) => {
        const h = b.value > 0 ? Math.max(6, (b.value / max) * barsArea) : 2;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
            style={{ height }}
          >
            <span className="text-[9px] font-black tabular-nums text-trebol-text/45 leading-none">
              {b.value > 0 ? b.value : ''}
            </span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
              className="w-full rounded-t-md"
              style={{
                background:
                  b.value > 0
                    ? `linear-gradient(180deg, ${AMBER_LIGHT}, ${AMBER})`
                    : 'var(--color-trebol-border, #e5e7eb)',
                minHeight: 2,
              }}
            />
            <span className="text-[9px] font-bold text-trebol-text/40 leading-none truncate w-full text-center">
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Gamification overview band mounted above the skill path: activity-over-time
 * chart, current-week mini chart, per-skill progress and a small stat row.
 * Presentational — every number arrives pre-derived from real student data.
 */
export function ProgressOverview({
  sessionDates,
  totalStars,
  goldBadges,
  levelsCompleted,
  skills,
}: ProgressOverviewProps) {
  const t = useTranslations('dashboard');
  const [range, setRange] = useState<Range>('year');

  const activityBuckets = useMemo(() => {
    if (range === 'week') return bucketByLast7Days(sessionDates);
    if (range === 'month') return bucketByLast30Days(sessionDates);
    return bucketByLast12Months(sessionDates);
  }, [range, sessionDates]);

  const weekBuckets = useMemo(() => bucketByCurrentWeek(sessionDates), [sessionDates]);

  const todayIdx = useMemo(() => mondayIndex(startOfDay(new Date())), []);

  const hasActivity = activityBuckets.some((b) => b.value > 0);

  const ranges: Array<{ key: Range; label: string }> = [
    { key: 'week', label: t('overviewWeek') },
    { key: 'month', label: t('overviewMonth') },
    { key: 'year', label: t('overviewYear') },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto w-full px-4 sm:px-6 mb-6 grid gap-4"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-trebol-text tracking-tight leading-tight">
                {t('overviewActivityTitle')}
              </h3>
              <p className="text-[11px] font-semibold text-trebol-text/50 mt-0.5 truncate">
                {t('overviewActivitySubtitle')}
              </p>
            </div>
            <div className="flex shrink-0 rounded-xl bg-trebol-text/[0.05] p-0.5">
              {ranges.map((r) => {
                const on = r.key === range;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    style={
                      on
                        ? { background: AMBER, color: '#fff', boxShadow: `0 4px 10px -4px ${AMBER}` }
                        : { color: AMBER_DARK }
                    }
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {hasActivity ? (
            <BarChart buckets={activityBuckets} height={150} />
          ) : (
            <div className="h-[150px] grid place-items-center text-[12px] font-semibold text-trebol-text/40">
              {t('overviewNoData')}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-5 flex flex-col">
          <h3 className="text-sm font-black text-trebol-text tracking-tight mb-4">
            {t('overviewThisWeek')}
          </h3>
          <div className="flex-1 flex items-end">
            <div className="flex items-end gap-1.5 sm:gap-2 w-full">
              {weekBuckets.map((b, i) => {
                const max = Math.max(1, ...weekBuckets.map((x) => x.value));
                const barsArea = 120 - BAR_LABEL_HEADROOM;
                const h = b.value > 0 ? Math.max(6, (b.value / max) * barsArea) : 2;
                const today = i === todayIdx;
                return (
                  <div
                    key={b.label}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                    style={{ height: 120 }}
                  >
                    <span className="text-[9px] font-black tabular-nums text-trebol-text/45 leading-none">
                      {b.value > 0 ? b.value : ''}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full rounded-t-md"
                      style={{
                        background:
                          b.value > 0
                            ? `linear-gradient(180deg, ${AMBER_LIGHT}, ${AMBER})`
                            : 'var(--color-trebol-border, #e5e7eb)',
                        outline: today ? `2px solid ${AMBER_DARK}` : 'none',
                        outlineOffset: 1,
                        minHeight: 2,
                      }}
                    />
                    <span
                      className="text-[9px] font-bold leading-none"
                      style={{ color: today ? AMBER_DARK : 'rgba(60,40,40,.4)' }}
                    >
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-5">
        <h3 className="text-sm font-black text-trebol-text tracking-tight mb-4">
          {t('overviewBySkill')}
        </h3>
        <div className="grid gap-3">
          {skills.map((s) => {
            const p = PALETTE[s.key];
            const Ic = ICON[s.key];
            const active = s.total > 0 && s.sessions > 0;
            const pctDone = s.total > 0 ? Math.min(100, Math.round((s.done / s.total) * 100)) : 0;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className="grid place-items-center w-9 h-9 rounded-xl shrink-0"
                  style={
                    active
                      ? { background: `linear-gradient(150deg, ${p.light}, ${p.c})` }
                      : { background: p.soft }
                  }
                >
                  <Ic size={18} strokeWidth={2.4} color={active ? '#fff' : p.c} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-black text-trebol-text truncate">{s.label}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider leading-none shrink-0"
                      style={{ background: p.soft, color: p.c }}
                    >
                      {s.cefr ? s.cefr.replace('_', ' ') : '—'}
                    </span>
                    <span className="ml-auto text-[11px] font-black tabular-nums text-trebol-text/55 shrink-0">
                      {s.done}/{s.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-trebol-text/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pctDone}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${p.light}, ${p.c})` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-4 flex items-center gap-3">
          <span
            className="grid place-items-center w-11 h-11 rounded-2xl shrink-0"
            style={{ background: `linear-gradient(150deg, ${AMBER_LIGHT}, ${AMBER})` }}
          >
            <Star size={20} color="#fff" fill="#fff" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <span className="block text-xl font-black tabular-nums text-trebol-text leading-none">
              {totalStars}
            </span>
            <span className="block text-[11px] font-bold text-trebol-text/50 mt-0.5 truncate">
              {t('overviewStars')}
              {goldBadges > 0 ? ` · ${goldBadges}★` : ''}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-4 flex items-center gap-3">
          <span
            className="grid place-items-center w-11 h-11 rounded-2xl shrink-0"
            style={{ background: 'linear-gradient(150deg, #7fd0ad, #469E7B)' }}
          >
            <GraduationCap size={20} color="#fff" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <span className="block text-xl font-black tabular-nums text-trebol-text leading-none">
              {levelsCompleted}
            </span>
            <span className="block text-[11px] font-bold text-trebol-text/50 mt-0.5 truncate">
              {t('overviewLevels')}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
