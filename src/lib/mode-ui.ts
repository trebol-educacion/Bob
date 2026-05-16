import type { DynamicCard } from '@/lib/types/practice';

/** Returns the lucide-react icon name for a given DynamicCard. */
export function getModeIcon(card: DynamicCard): string {
  const PART_ICON: Record<string, string> = {
    starters_part1: 'Hand',
    starters_part2: 'HelpCircle',
    starters_part3: 'BookOpen',
    starters_part4: 'User',
    movers_part1: 'GitCompare',
    movers_part2: 'MessageCircle',
    movers_part3: 'BookImage',
    movers_part4: 'User',
    movers_part5: 'ImageIcon',
    flyers_part1: 'BookOpen',
    ket_part1: 'ClipboardList',
    ket_part2: 'ClipboardList',
    pet_p1: 'MessageSquare',
    pet_p2: 'MessageSquare',
    pet_p3: 'MessageSquare',
    pet_p4: 'User',
    fce_p1: 'MessageSquare',
    fce_p2: 'Sparkles',
    fce_p3: 'MessageSquare',
    fce_p4: 'User',
    cae_p1: 'MessageSquare',
    cae_p2: 'Sparkles',
    cae_p3: 'MessageSquare',
    cae_p4: 'User',
    cpe_p1: 'MessageSquare',
    cpe_p2: 'Sparkles',
    cpe_p3a: 'MessageSquare',
    cpe_p3b: 'MessageSquare',
    cpe_p4: 'User',
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
  if (card.framework === 'cambridge' && card.exam_part.startsWith('starters_')) return 'Pre-A1';
  if (!card.cefr_level) return '';
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

/** Returns the section heading under which this card is grouped in ModeSelection. */
export function getModeSection(card: DynamicCard): string {
  const { framework, exam_part } = card;

  if (framework === 'cambridge') {
    if (exam_part.startsWith('starters_') || exam_part.startsWith('movers_') || exam_part.startsWith('flyers_')) {
      return 'Cambridge Young Learners';
    }
    if (exam_part.startsWith('ket_')) return 'Cambridge KET (A2 Key)';
    if (exam_part.startsWith('pet_')) return 'Cambridge PET (B1 Preliminary)';
    if (exam_part.startsWith('fce_')) return 'Cambridge FCE (B2 First)';
    if (exam_part.startsWith('cae_')) return 'Cambridge CAE (C1)';
    if (exam_part.startsWith('cpe_')) return 'Cambridge CPE (C2)';
    return 'Cambridge English';
  }

  if (framework === 'toefl') return 'TOEFL iBT';
  if (framework === 'generic') return 'Práctica libre';

  return 'Other';
}

const YL_FAMILY_WEIGHT: Record<string, number> = {
  starters: 1,
  movers: 2,
  flyers: 3,
};

export function getModeSortWeight(card: DynamicCard): number {
  const { framework, exam_part } = card;

  if (framework === 'cambridge') {
    const ylMatch = exam_part.match(/^(starters|movers|flyers)_part(\d+)$/);
    if (ylMatch) {
      const family = YL_FAMILY_WEIGHT[ylMatch[1]] ?? 99;
      const part = parseInt(ylMatch[2], 10);
      return family * 100 + part;
    }
    const partMatch = exam_part.match(/_p?(\d+)([a-z]?)$/);
    if (partMatch) {
      const part = parseInt(partMatch[1], 10);
      const suffix = partMatch[2] ? partMatch[2].charCodeAt(0) - 96 : 0;
      return part * 10 + suffix;
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
