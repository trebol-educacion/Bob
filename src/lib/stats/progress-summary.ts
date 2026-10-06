export type StatsSkill = 'speaking' | 'reading' | 'listening' | 'writing';

export interface StudentStatRow {
  mode: string;
  sessions_count: number;
  avg_score: number;
  score_max: number;
  last_done: string;
}

export interface StudentActivityEntry {
  mode: string;
  score10: number | null;
  created_at: string;
}

export interface LastAssessment {
  cefr_band: string;
  occurred_at: string;
}

export interface ProgressPeriods {
  week: number;
  month: number;
  year: number;
  total: number;
}

export type ActivityTargets = Record<string, Record<string, number>>;

export interface StudentStatsResult {
  rows: StudentStatRow[];
  total_sessions: number;
  global_avg: number | null;
  session_dates: string[];
  activities: StudentActivityEntry[];
  streak: number;
  total_stars: number;
  periods: ProgressPeriods;
  targets: ActivityTargets;
  last_tests: Record<StatsSkill, LastAssessment | null>;
}

const SKILLS: StatsSkill[] = ['speaking', 'reading', 'listening', 'writing'];

/**
 * @returns StudentStatsResult
 */
export function emptyStudentStats(): StudentStatsResult {
  return {
    rows: [],
    total_sessions: 0,
    global_avg: null,
    session_dates: [],
    activities: [],
    streak: 0,
    total_stars: 0,
    periods: { week: 0, month: 0, year: 0, total: 0 },
    targets: {},
    last_tests: { speaking: null, reading: null, listening: null, writing: null },
  };
}

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const asNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

/**
 * @param raw unknown RPC payload of bob.progress_summary
 * @returns StudentStatsResult
 */
export function mapProgressSummary(raw: unknown): StudentStatsResult {
  const result = emptyStudentStats();
  if (typeof raw !== 'object' || raw === null) return result;
  const data = raw as Record<string, unknown>;

  result.total_sessions = asNumber(data.total_sessions);
  result.global_avg = data.global_avg === null || data.global_avg === undefined ? null : asNumber(data.global_avg);
  result.streak = asNumber(data.streak);
  result.total_stars = asNumber(data.total_stars);

  const periods = (data.periods ?? {}) as Record<string, unknown>;
  result.periods = {
    week: asNumber(periods.week),
    month: asNumber(periods.month),
    year: asNumber(periods.year),
    total: asNumber(periods.total),
  };

  result.rows = asArray(data.by_mode).map((r) => ({
    mode: String(r.mode),
    sessions_count: asNumber(r.sessions_count),
    avg_score: asNumber(r.avg_score),
    score_max: 10,
    last_done: String(r.last_done),
  }));

  result.session_dates = Array.isArray(data.session_dates) ? (data.session_dates as unknown[]).map(String) : [];

  result.activities = asArray(data.activities).map((a) => ({
    mode: String(a.mode),
    score10: a.score10 === null || a.score10 === undefined ? null : asNumber(a.score10),
    created_at: String(a.created_at),
  }));

  for (const t of asArray(data.targets)) {
    (result.targets[String(t.skill)] ??= {})[String(t.cefr_level)] = asNumber(t.target_count);
  }

  for (const t of asArray(data.last_tests)) {
    const skill = String(t.skill) as StatsSkill;
    if (SKILLS.includes(skill)) {
      result.last_tests[skill] = { cefr_band: String(t.cefr_band), occurred_at: String(t.occurred_at) };
    }
  }

  return result;
}
