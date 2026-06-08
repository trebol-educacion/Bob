import type { DynamicCard } from '@/lib/types/practice';

/** Returns the lucide-react icon name for a given DynamicCard. */
export function getModeIcon(card: DynamicCard): string {
  const PART_ICON: Record<string, string> = {
    starters_part1: 'ListenAndPoint',
    starters_part2: 'LookAndAnswer',
    starters_part3: 'WhatsThis',
    starters_part4: 'PersonalQuestions',
    movers_part1: 'FindTheDifferences',
    movers_part2: 'InformationExchange',
    movers_part3: 'PictureStoryMovers',
    movers_part4: 'PersonalQuestionsMovers',
    movers_part5: 'MoreAboutYou',
    flyers_part1: 'FlyersFindDifferences',
    ket_listening_part1: 'KETListening',
    ket_listening_part2: 'KETListening',
    ket_listening_part3: 'KETListening',
    ket_listening_part4: 'KETListening',
    ket_listening_part5: 'KETListening',
    ket_reading_part1: 'KETReading',
    ket_reading_part2: 'KETReading',
    ket_reading_part3: 'KETReading',
    ket_reading_part4: 'KETReading',
    ket_reading_part5: 'KETReading',
    ket_writing_part6: 'KETWriting',
    ket_writing_part7: 'KETWriting',
    ket_part1: 'KETSpeaking',
    ket_part2: 'KETSpeaking',
    pet_listening_part1: 'PETListening',
    pet_listening_part2: 'PETListening',
    pet_listening_part3: 'PETListening',
    pet_listening_part4: 'PETListening',
    pet_reading_part1: 'PETReading',
    pet_reading_part2: 'PETReading',
    pet_reading_part3: 'PETReading',
    pet_reading_part4: 'PETReading',
    pet_reading_part5: 'PETReading',
    pet_reading_part6: 'PETReading',
    pet_writing_part1: 'PETWriting',
    pet_writing_part2: 'PETWriting',
    pet_p1: 'PETSpeaking',
    pet_p2: 'PETSpeaking',
    pet_p3: 'PETSpeaking',
    pet_p4: 'PETSpeaking',
    fce_listening_part1: 'FCEListening',
    fce_listening_part2: 'FCEListening',
    fce_listening_part3: 'FCEListening',
    fce_listening_part4: 'FCEListening',
    fce_reading_part1: 'FCEReading',
    fce_reading_part2: 'FCEReading',
    fce_reading_part3: 'FCEReading',
    fce_reading_part4: 'FCEReading',
    fce_reading_part5: 'FCEReading',
    fce_reading_part6: 'FCEReading',
    fce_reading_part7: 'FCEReading',
    fce_writing_part1: 'FCEWriting',
    fce_writing_part2: 'FCEWriting',
    fce_p1: 'FCESpeaking',
    fce_p2: 'FCESpeaking',
    fce_p3: 'FCESpeaking',
    fce_p4: 'FCESpeaking',
    cae_p1: 'CAEInterview',
    cae_p2: 'CAELongTurn',
    cae_p3: 'CAECollaborative',
    cae_p4: 'CAEDiscussion',
    cpe_p1: 'CPEInterview',
    cpe_p2: 'CPECollaborative',
    cpe_p3a: 'CPEMonologue',
    cpe_p3b: 'CPEExtendedDiscussion',
    cpe_p4: 'CPEFinalDiscussion',
    listen_repeat: 'Headphones',
    interview: 'Mic2',
    situation: 'MessageSquare',
    image: 'Image',
    conversation: 'Mic2',
  };

  if (card.exam_part in PART_ICON) return PART_ICON[card.exam_part];
  if (card.framework === 'toefl') return 'Headphones';
  return 'BookOpen';
}

function cefrLabel(card: DynamicCard): string {
  if (!card.cefr_level) return '';
  if (card.cefr_level === 'pre_a1') return 'Pre-A1';
  return card.cefr_level.toUpperCase();
}

function estimatedMinutes(card: DynamicCard): number {
  const part = card.exam_part;
  if (part === 'starters_part1' || part === 'starters_part2' || part === 'starters_part4') return 3;
  if (part === 'starters_part3') return 4;
  if (part === 'movers_part2' || part === 'movers_part4') return 4;
  if (part === 'movers_part1' || part === 'movers_part3' || part === 'movers_part5') return 5;
  if (part === 'listen_repeat') return 4;
  if (card.framework === 'cambridge' && (card.cefr_level === 'b2' || card.cefr_level === 'c1' || card.cefr_level === 'c2')) return 6;
  if (card.framework === 'cambridge') return 5;
  if (card.framework === 'toefl') return 5;
  return 4;
}

/** Returns the badge string for a card (e.g. "Pre-A1 · 3 min"). */
export function getModeBadge(card: DynamicCard): string {
  const label = cefrLabel(card);
  const mins = estimatedMinutes(card);
  return label ? `${label} · ${mins} min` : `${mins} min`;
}

/**
 * Generic cards that should render inside the level section instead of
 * "Free practice" (e.g. Phrase Practice surfaces next to the B1/B2 parts so
 * the student sees it grouped by level). Keyed by `mode_key|cefr_level`
 * because the catalog reuses `mode_key='generic_situation'` across A1/A2/B1/B2.
 */
const GENERIC_AS_CAMBRIDGE: Record<string, { weight: number }> = {
  'generic_situation|b1': { weight: 9000 },
  'generic_situation|b2': { weight: 9000 },
};

function genericOverrideKey(card: DynamicCard): string {
  return `${card.mode_key}|${card.cefr_level ?? ''}`;
}

/** True when this card, although `framework='generic'`, should be grouped with a Cambridge framework. */
export function isGenericGroupedWithCambridge(card: DynamicCard): boolean {
  return genericOverrideKey(card) in GENERIC_AS_CAMBRIDGE;
}

/** Returns the section heading under which this card is grouped in ModeSelection. */
export function getModeSection(card: DynamicCard): string {
  const { framework } = card;

  if (framework === 'cambridge' || (framework === 'generic' && isGenericGroupedWithCambridge(card))) {
    const lvl = cefrLabel(card);
    return lvl ? `English · ${lvl}` : 'English';
  }

  if (framework === 'toefl') return 'TOEFL iBT';
  if (framework === 'generic') return 'Free practice';

  return 'Other';
}

const YL_FAMILY_WEIGHT: Record<string, number> = {
  starters: 1,
  movers: 2,
  flyers: 3,
};

const SKILL_ORDER: Record<string, number> = {
  reading: 1,
  writing: 2,
  listening: 3,
};
const SPEAKING_BASE = 4000;

export function getModeSortWeight(card: DynamicCard): number {
  const { framework, exam_part } = card;

  const override = GENERIC_AS_CAMBRIDGE[genericOverrideKey(card)];
  if (override) return override.weight;

  if (framework === 'cambridge') {
    const ylMatch = exam_part.match(/^(starters|movers|flyers)_part(\d+)$/);
    if (ylMatch) {
      const family = YL_FAMILY_WEIGHT[ylMatch[1]] ?? 99;
      const part = parseInt(ylMatch[2], 10);
      return family * 100 + part;
    }
    const skillMatch = exam_part.match(/^[a-z]+_(reading|writing|listening)_part(\d+)$/);
    if (skillMatch) {
      const skill = SKILL_ORDER[skillMatch[1]];
      const part = parseInt(skillMatch[2], 10);
      return skill * 1000 + part * 10;
    }
    const speakingMatch = exam_part.match(/_p(?:art)?(\d+)([a-z]?)$/);
    if (speakingMatch) {
      const part = parseInt(speakingMatch[1], 10);
      const suffix = speakingMatch[2] ? speakingMatch[2].charCodeAt(0) - 96 : 0;
      return SPEAKING_BASE + part * 10 + suffix;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

/** Returns the display title for a card. */
export function getModeTitle(card: DynamicCard): string {
  return card.label;
}

/** Returns the display description for a card. */
export function getModeDescription(card: DynamicCard): string {
  return card.description ?? '';
}

export type CambridgeFamily = 'starters' | 'movers' | 'flyers' | 'ket' | 'pet' | 'fce' | 'cae' | 'cpe';
export type YLFamily = 'starters' | 'movers' | 'flyers';

export function getYLFamily(card: DynamicCard): YLFamily | null {
  const m = card.exam_part.match(/^(starters|movers|flyers)_/);
  return m ? (m[1] as YLFamily) : null;
}

export function getCambridgeFamily(card: DynamicCard): CambridgeFamily | null {
  if (card.framework === 'generic') {
    const key = `${card.mode_key}|${card.cefr_level ?? ''}`;
    if (key === 'generic_situation|b1') return 'pet';
    if (key === 'generic_situation|b2') return 'fce';
    return null;
  }
  if (card.framework !== 'cambridge') return null;
  const m = card.exam_part.match(/^(starters|movers|flyers|ket|pet|fce|cae|cpe)(_|$)/);
  return m ? (m[1] as CambridgeFamily) : null;
}

export interface YLCardTheme {
  cardBg: string;
  cardRing: string;
  iconBg: string;
  iconText: string;
  badgeBg: string;
  badgeText: string;
  titleText: string;
  decoration: string;
}

const CAMBRIDGE_THEMES: Record<CambridgeFamily, YLCardTheme> = {
  starters: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-violet-100 hover:ring-violet-300 hover:ring-2',
    iconBg: 'bg-violet-50 group-hover:bg-violet-100',
    iconText: 'text-violet-700',
    badgeBg: 'bg-white ring-1 ring-violet-200',
    badgeText: 'text-violet-700',
    titleText: 'text-slate-900',
    decoration: 'text-violet-100',
  },
  movers: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-amber-100 hover:ring-amber-300 hover:ring-2',
    iconBg: 'bg-amber-50 group-hover:bg-amber-100',
    iconText: 'text-amber-800',
    badgeBg: 'bg-white ring-1 ring-amber-200',
    badgeText: 'text-amber-800',
    titleText: 'text-slate-900',
    decoration: 'text-amber-100',
  },
  flyers: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-indigo-100 hover:ring-indigo-300 hover:ring-2',
    iconBg: 'bg-indigo-50 group-hover:bg-indigo-100',
    iconText: 'text-indigo-700',
    badgeBg: 'bg-white ring-1 ring-indigo-200',
    badgeText: 'text-indigo-700',
    titleText: 'text-slate-900',
    decoration: 'text-indigo-100',
  },
  ket: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-rose-100 hover:ring-rose-300 hover:ring-2',
    iconBg: 'bg-rose-50 group-hover:bg-rose-100',
    iconText: 'text-rose-700',
    badgeBg: 'bg-white ring-1 ring-rose-200',
    badgeText: 'text-rose-700',
    titleText: 'text-slate-900',
    decoration: 'text-rose-100',
  },
  pet: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-emerald-100 hover:ring-emerald-300 hover:ring-2',
    iconBg: 'bg-emerald-50 group-hover:bg-emerald-100',
    iconText: 'text-emerald-700',
    badgeBg: 'bg-white ring-1 ring-emerald-200',
    badgeText: 'text-emerald-700',
    titleText: 'text-slate-900',
    decoration: 'text-emerald-100',
  },
  fce: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-sky-100 hover:ring-sky-300 hover:ring-2',
    iconBg: 'bg-sky-50 group-hover:bg-sky-100',
    iconText: 'text-sky-700',
    badgeBg: 'bg-white ring-1 ring-sky-200',
    badgeText: 'text-sky-700',
    titleText: 'text-slate-900',
    decoration: 'text-sky-100',
  },
  cae: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-stone-200 hover:ring-stone-400 hover:ring-2',
    iconBg: 'bg-stone-100 group-hover:bg-stone-200',
    iconText: 'text-stone-700',
    badgeBg: 'bg-white ring-1 ring-stone-300',
    badgeText: 'text-stone-700',
    titleText: 'text-slate-900',
    decoration: 'text-stone-200',
  },
  cpe: {
    cardBg: 'bg-white',
    cardRing: 'ring-1 ring-zinc-200 hover:ring-zinc-400 hover:ring-2',
    iconBg: 'bg-zinc-100 group-hover:bg-zinc-200',
    iconText: 'text-zinc-800',
    badgeBg: 'bg-white ring-1 ring-zinc-300',
    badgeText: 'text-zinc-800',
    titleText: 'text-slate-900',
    decoration: 'text-zinc-200',
  },
};

export function getYLCardTheme(card: DynamicCard): YLCardTheme | null {
  const family = getCambridgeFamily(card);
  return family ? CAMBRIDGE_THEMES[family] : null;
}

/**
 * Subtitle surfaced under the kid-friendly title, describing the activity by
 * CEFR level + skill/part without referencing any official exam brand.
 * Returns empty string for generic modes with no level context.
 */
export function getModeOfficialName(card: DynamicCard): string {
  const { framework, exam_part } = card;
  const lvl = cefrLabel(card);

  if (framework === 'generic') {
    const key = `${card.mode_key}|${card.cefr_level ?? ''}`;
    if (key === 'generic_situation|b1' || key === 'generic_situation|b2') {
      return lvl ? `${lvl} · Phrase Practice` : 'Phrase Practice';
    }
    return '';
  }
  if (framework === 'cambridge') {
    const ylMatch = exam_part.match(/^(?:starters|movers|flyers)_part(\d+)$/);
    if (ylMatch) {
      return lvl ? `${lvl} · Part ${ylMatch[1]}` : `Part ${ylMatch[1]}`;
    }
    const skillMatch = exam_part.match(/^[a-z]+_(reading|writing|listening|speaking)_part(\d+)$/);
    if (skillMatch) {
      const skill = skillMatch[1].charAt(0).toUpperCase() + skillMatch[1].slice(1);
      return lvl ? `${lvl} · ${skill} Part ${skillMatch[2]}` : `${skill} Part ${skillMatch[2]}`;
    }
    const partMatch = exam_part.match(/^[a-z]+_p?(\d+)([a-z]?)$/);
    if (partMatch) {
      const part = partMatch[1] + (partMatch[2] ? partMatch[2].toUpperCase() : '');
      return lvl ? `${lvl} · Part ${part}` : `Part ${part}`;
    }
  }
  if (framework === 'toefl') {
    if (exam_part === 'listen_repeat') return 'TOEFL iBT · Listen & Repeat';
    if (exam_part === 'interview') return 'TOEFL iBT · Interview';
    return 'TOEFL iBT';
  }
  return '';
}
