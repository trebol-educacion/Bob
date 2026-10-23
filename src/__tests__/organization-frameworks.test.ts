import { describe, it, expect } from 'vitest';
import {
  normalizeFrameworkName,
  extractOrgFrameworks,
} from '@/lib/organization/frameworks';

describe('normalizeFrameworkName', () => {
  it('mapea nombres conocidos a ModeFramework', () => {
    expect(normalizeFrameworkName('Cambridge English')).toBe('cambridge');
    expect(normalizeFrameworkName('TOEFL iBT')).toBe('toefl');
  });

  it('nombres desconocidos devuelven null', () => {
    expect(normalizeFrameworkName('Trinity ISE')).toBeNull();
  });
});

describe('extractOrgFrameworks — embed intra-schema (mia → mia)', () => {
  it('filtra por type=english y normaliza', () => {
    const rows = [
      { pedagogical_frameworks: { name: 'Cambridge English', type: 'english' } },
      { pedagogical_frameworks: { name: 'Alguna otra cosa', type: 'other' } },
      { pedagogical_frameworks: { name: 'TOEFL iBT', type: 'english' } },
    ];
    expect(extractOrgFrameworks(rows)).toEqual(['cambridge', 'toefl']);
  });

  it('filas sin pedagogical_frameworks no rompen la extracción', () => {
    expect(extractOrgFrameworks([{ pedagogical_frameworks: null }])).toEqual([]);
  });
});
