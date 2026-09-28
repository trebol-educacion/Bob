import { describe, it, expect } from 'vitest';
import { resolveBobAccessDenial } from '@/lib/access-gate';

const base = {
  profileErrored: false,
  hasProfile: true,
  role: 'student',
  orgFound: true,
  bobEnabled: true,
  licenseResult: true as boolean | null | undefined,
};

describe('resolveBobAccessDenial — orden histórico del gate', () => {
  it('alumno con todo en regla → acceso', () => {
    expect(resolveBobAccessDenial(base)).toBeNull();
  });

  it('error en la query de profile → difiere la denegación (null)', () => {
    expect(resolveBobAccessDenial({ ...base, profileErrored: true, hasProfile: false })).toBeNull();
  });

  it('sin profile → no_profile', () => {
    expect(resolveBobAccessDenial({ ...base, hasProfile: false })).toBe('no_profile');
  });

  it('rol no student → not_student (docentes y admins fuera, como siempre)', () => {
    expect(resolveBobAccessDenial({ ...base, role: 'teacher' })).toBe('not_student');
    expect(resolveBobAccessDenial({ ...base, role: null })).toBe('not_student');
  });

  it('sin organización → no_organization', () => {
    expect(resolveBobAccessDenial({ ...base, orgFound: false, bobEnabled: undefined })).toBe('no_organization');
  });

  it('flag del colegio apagado → bob_not_enabled, aunque tenga licencia', () => {
    expect(resolveBobAccessDenial({ ...base, bobEnabled: false })).toBe('bob_not_enabled');
    expect(resolveBobAccessDenial({ ...base, bobEnabled: null })).toBe('bob_not_enabled');
  });
});

describe('resolveBobAccessDenial — licencia individual (noobe-hub)', () => {
  it('licencia revocada → no_license', () => {
    expect(resolveBobAccessDenial({ ...base, licenseResult: false })).toBe('no_license');
  });

  it('fail-open: RPC ausente o fallido (null/undefined) → acceso', () => {
    expect(resolveBobAccessDenial({ ...base, licenseResult: null })).toBeNull();
    expect(resolveBobAccessDenial({ ...base, licenseResult: undefined })).toBeNull();
  });

  it('el fail-open no anula el flag: colegio apagado sigue denegando', () => {
    expect(resolveBobAccessDenial({ ...base, bobEnabled: false, licenseResult: null })).toBe('bob_not_enabled');
  });

  it('la licencia se evalúa después de las causas previas (no enmascara not_student)', () => {
    expect(resolveBobAccessDenial({ ...base, role: 'teacher', licenseResult: false })).toBe('not_student');
  });
});
