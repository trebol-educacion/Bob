'use client';

import type { CardPresentationRules } from '@/lib/types/practice';
import { useActivityPresentation } from './useActivityPresentation';

const NO_RULES: CardPresentationRules = {};

/**
 * @param examPart exam part of the activity
 * @returns presentation rules of that part, empty when unknown
 */
export function useActivityRules(examPart: string): CardPresentationRules {
  return useActivityPresentation(examPart)?.rules ?? NO_RULES;
}
