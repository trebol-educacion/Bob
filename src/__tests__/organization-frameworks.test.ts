import { describe, it, expect } from 'vitest';
import {
  normalizeFrameworkName,
  resolveFrameworkNames,
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

describe('resolveFrameworkNames — resolución en dos pasos (public → mia)', () => {
  const frameworks = [
    { id: 'fw-1', name: 'Cambridge English', type: 'english' },
    { id: 'fw-2', name: 'TOEFL iBT', type: 'english' },
    { id: 'fw-3', name: 'Trinity ISE', type: 'english' },
  ];

  it('resuelve los ids del alumno contra el catálogo de mia.pedagogical_frameworks', () => {
    expect(resolveFrameworkNames(['fw-1', 'fw-2'], frameworks)).toEqual(['cambridge', 'toefl']);
  });

  it('descarta ids sin match en el catálogo, sin lanzar', () => {
    expect(resolveFrameworkNames(['fw-1', 'missing-id'], frameworks)).toEqual(['cambridge']);
  });

  it('descarta frameworks con nombre no mapeado', () => {
    expect(resolveFrameworkNames(['fw-3'], frameworks)).toEqual([]);
  });

  it('deduplica frameworks repetidos', () => {
    expect(resolveFrameworkNames(['fw-1', 'fw-1'], frameworks)).toEqual(['cambridge']);
  });

  it('lista de ids vacía → lista vacía', () => {
    expect(resolveFrameworkNames([], frameworks)).toEqual([]);
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
