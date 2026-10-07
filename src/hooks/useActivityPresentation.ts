'use client';

import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { CardPresentation } from '@/lib/types/practice';

/**
 * @param examPart exam part of the activity
 * @returns catalog presentation of that part, undefined when unknown
 */
export function useActivityPresentation(examPart: string): CardPresentation | undefined {
  const { allDynamicCards } = useOrganization();
  return useMemo(
    () => allDynamicCards.find((card) => card.exam_part === examPart)?.presentation,
    [allDynamicCards, examPart],
  );
}
