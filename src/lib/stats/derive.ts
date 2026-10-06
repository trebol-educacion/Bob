import type { StatsSkill as Skill, StudentStatRow, StudentStatsResult } from './progress-summary';

export const PICKABLE_LEVELS = ['pre_a1', 'a1', 'a2', 'b1', 'b2'] as const;
export const LEVEL_LABEL: Record<string, string> = {
  pre_a1: 'Pre-A1',
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
};

export const LEVEL_ORDER: Record<string, number> = {
  'Pre-A1': 0,
  'A1': 1,
  'A2': 2,
  'B1': 3,
  'B2': 4,
  'C1': 5,
  'C2': 6,
};


export const MODE_LABEL: Record<string, string> = {
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


/**
 * @param current string
 * @returns string | null null when already at the top level
 */
export function nextLevelLabel(current: string): string | null {
  const i = PICKABLE_LEVELS.indexOf(current as (typeof PICKABLE_LEVELS)[number]);
  if (i < 0 || i >= PICKABLE_LEVELS.length - 1) return null;
  const next = PICKABLE_LEVELS[i + 1];
  return LEVEL_LABEL[next] ?? next;
}

export function nextLevelValue(current: string): string {
  const i = PICKABLE_LEVELS.indexOf(current as (typeof PICKABLE_LEVELS)[number]);
  if (i < 0) return current;
  return PICKABLE_LEVELS[Math.min(i + 1, PICKABLE_LEVELS.length - 1)];
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

function prettyMode(mode: string): string {
  return mode
    .replace(/^cambridge_/, '')
    .replace(/^toefl_/, 'toefl_')
    .split('_')
    .map((seg) => {
      const part = seg.match(/^part(\d+)$/);
      if (part) return `Part ${part[1]}`;
      if (['ket', 'pet', 'fce', 'cae', 'cpe', 'toefl'].includes(seg)) return seg.toUpperCase();
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    })
    .join(' ');
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

export function relativeTime(iso: string): string {
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

export interface Derived {
  streak: number;
  totalXp: number;
  goldBadges: number;
  totalStars: number;
  bySkill: Record<Skill, { pct: number; sessions: number }>;
  bySkillLevel: Record<Skill, Record<string, { pct: number; sessions: number }>>;
  activitiesByLevel: Record<Skill, Record<string, Array<{ label: string; score10: number | null; created_at: string }>>>;
  groups: Array<{ key: string; title: string; framework: string; level: string; nodes: PathNode[] }>;
}

export function deriveStats(stats: StudentStatsResult): Derived {
  const streak = stats.streak;
  let totalXp = 0;
  let goldBadges = 0;
  const skillAgg: Record<Skill, { sum: number; max: number; sessions: number }> = {
    speaking: { sum: 0, max: 0, sessions: 0 },
    reading: { sum: 0, max: 0, sessions: 0 },
    listening: { sum: 0, max: 0, sessions: 0 },
    writing: { sum: 0, max: 0, sessions: 0 },
  };
  const levelAgg: Record<Skill, Record<string, { sum: number; max: number; sessions: number }>> = {
    speaking: {}, reading: {}, listening: {}, writing: {},
  };
  const nodes: PathNode[] = stats.rows.map<PathNode>((r: StudentStatRow) => {
    const pct = r.score_max > 0 ? (r.avg_score / r.score_max) * 100 : 0;
    const stars = starsFor(pct);
    const skill = inferSkill(r.mode);
    const level = inferLevel(r.mode);
    totalXp += Math.round(r.avg_score * r.sessions_count);
    if (pct >= 80) goldBadges++;
    skillAgg[skill].sum += r.avg_score * r.sessions_count;
    skillAgg[skill].max += r.score_max * r.sessions_count;
    skillAgg[skill].sessions += r.sessions_count;
    const la = (levelAgg[skill][level] ??= { sum: 0, max: 0, sessions: 0 });
    la.sum += r.avg_score * r.sessions_count;
    la.max += r.score_max * r.sessions_count;
    la.sessions += r.sessions_count;
    return {
      mode: r.mode,
      label: MODE_LABEL[r.mode] ?? prettyMode(r.mode),
      framework: inferFramework(r.mode),
      level,
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

  const bySkillLevel: Record<Skill, Record<string, { pct: number; sessions: number }>> = {
    speaking: {}, reading: {}, listening: {}, writing: {},
  };
  for (const skill of ['speaking', 'reading', 'listening', 'writing'] as Skill[]) {
    for (const [level, a] of Object.entries(levelAgg[skill])) {
      bySkillLevel[skill][level] = {
        pct: a.max > 0 ? (a.sum / a.max) * 100 : 0,
        sessions: a.sessions,
      };
    }
  }

  const activitiesByLevel: Record<Skill, Record<string, Array<{ label: string; score10: number | null; created_at: string }>>> = {
    speaking: {}, reading: {}, listening: {}, writing: {},
  };
  for (const a of stats.activities) {
    const skill = inferSkill(a.mode);
    const level = inferLevel(a.mode);
    (activitiesByLevel[skill][level] ??= []).push({
      label: MODE_LABEL[a.mode] ?? prettyMode(a.mode),
      score10: a.score10,
      created_at: a.created_at,
    });
  }
  for (const skill of ['speaking', 'reading', 'listening', 'writing'] as Skill[]) {
    for (const level of Object.keys(activitiesByLevel[skill])) {
      activitiesByLevel[skill][level].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
  }

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

  return { streak, totalXp, goldBadges, totalStars: stats.total_stars, bySkill, bySkillLevel, activitiesByLevel, groups };
}
