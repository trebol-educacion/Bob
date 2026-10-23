import type { CefrLevel, DynamicCard } from './types/practice';
import type { Skill } from './types/skills';
import { isGenericGroupedWithCambridge } from './mode-ui';

/**
 * @param cards
 * @param skill
 * @param level
 */
export function hasFreePracticeCards(
  cards: DynamicCard[],
  skill: Skill | null,
  level: CefrLevel | null,
): boolean {
  if (!skill || !level) return false;
  return cards.some(
    (card) =>
      card.framework === 'generic' &&
      card.skill === skill &&
      card.status !== 'hidden' &&
      (card.cefr_level === null || card.cefr_level === level) &&
      !isGenericGroupedWithCambridge(card),
  );
}
