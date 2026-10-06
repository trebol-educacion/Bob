'use client';

import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { CardPresentationRules } from '@/lib/types/practice';

/**
 * @param examPart exam part of the activity
 * @returns presentation rules of that part, empty when unknown
 */
export function useActivityRules(examPart: string): CardPresentationRules {
  const { allDynamicCards } = useOrganization();
  return useMemo(
    () => allDynamicCards.find((card) => card.exam_part === examPart)?.presentation?.rules ?? {},
    [allDynamicCards, examPart],
  );
}
