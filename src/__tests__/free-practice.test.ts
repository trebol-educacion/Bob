import { describe, it, expect } from 'vitest';
import { hasFreePracticeCards } from '@/lib/free-practice';
import type { DynamicCard } from '@/lib/types/practice';

function card(overrides: Partial<DynamicCard>): DynamicCard {
  return {
    framework: 'generic',
    exam_part: 'conversation',
    cefr_level: null,
    label: 'Card',
    description: null,
    mode_key: 'generic_conversation',
    status: 'enabled',
    skill: 'speaking',
    ...overrides,
  } as DynamicCard;
}

const cards: DynamicCard[] = [
  card({ mode_key: 'generic_conversation', cefr_level: null }),
  card({ mode_key: 'generic_image', exam_part: 'image', cefr_level: 'b1' }),
  card({ mode_key: 'generic_situation', exam_part: 'situation', cefr_level: 'b2' }),
  card({ framework: 'cambridge', mode_key: 'cambridge_pet_listening_part1', exam_part: 'listening_part1', cefr_level: 'b1', skill: 'listening' }),
];

describe('hasFreePracticeCards', () => {
  it('hay práctica libre en speaking B1', () => {
    expect(hasFreePracticeCards(cards, 'speaking', 'b1')).toBe(true);
  });

  it('sin genéricas de listening no hay práctica libre aunque haya actividades de examen', () => {
    expect(hasFreePracticeCards(cards, 'listening', 'b1')).toBe(false);
  });

  it('las genéricas agrupadas con Cambridge no cuentan como práctica libre', () => {
    const onlyGrouped = [card({ mode_key: 'generic_situation', exam_part: 'situation', cefr_level: 'b2' })];
    expect(hasFreePracticeCards(onlyGrouped, 'speaking', 'b2')).toBe(false);
  });

  it('las genéricas ocultas no cuentan', () => {
    const hidden = [card({ status: 'hidden' })];
    expect(hasFreePracticeCards(hidden, 'speaking', 'b1')).toBe(false);
  });

  it('las genéricas de otro nivel no cuentan', () => {
    const otherLevel = [card({ mode_key: 'generic_image', exam_part: 'image', cefr_level: 'a2' })];
    expect(hasFreePracticeCards(otherLevel, 'speaking', 'b1')).toBe(false);
  });

  it('sin destreza o sin nivel no hay práctica libre', () => {
    expect(hasFreePracticeCards(cards, null, 'b1')).toBe(false);
    expect(hasFreePracticeCards(cards, 'speaking', null)).toBe(false);
  });
});
