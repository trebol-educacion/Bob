import { isBrandNewStudent } from '@/lib/placement/first-entry-gate';

describe('isBrandNewStudent', () => {
  it('es true cuando skillLevels es null (aun sin cargar)', () => {
    expect(isBrandNewStudent(null)).toBe(true);
  });

  it('es true cuando skillLevels no tiene ninguna destreza', () => {
    expect(isBrandNewStudent({})).toBe(true);
  });

  it('es false cuando el alumno ya tiene nivel en alguna destreza', () => {
    const skillLevels = {
      reading: {
        cefr_level: 'a2' as const,
        origin: 'assessment' as const,
        confidence: null,
        last_assessment_at: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    };
    expect(isBrandNewStudent(skillLevels)).toBe(false);
  });
});
