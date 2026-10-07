import { KET_PARTS } from './families/ket';
import { PET_PARTS } from './families/pet';
import { TOEFL_PARTS } from './families/toefl';
import { YL_PARTS } from './families/yl';
import type { PlanPart } from './types';

export const FAMILIES: Record<string, PlanPart[]> = {
  ket: KET_PARTS,
  pet: PET_PARTS,
  yl: YL_PARTS,
  toefl: TOEFL_PARTS,
};

/**
 * @param family family key, or undefined for every family
 * @param examPart exam part, or undefined for every part of the family
 * @returns selected parts
 */
export function selectParts(family: string | undefined, examPart: string | undefined): PlanPart[] {
  const pool = family ? (FAMILIES[family] ?? []) : Object.values(FAMILIES).flat();
  return examPart ? pool.filter((part) => part.examPart === examPart) : pool;
}
