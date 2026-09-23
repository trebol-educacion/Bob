import { describe, it, expect, vi } from 'vitest';
import { loadStudentFrameworks, type StudentFrameworksSupabase } from '@/lib/organization/student-frameworks';

function fakeSupabase(responses: {
  links: { data: { framework_id: string }[] | null; error: { code: string; message: string } | null };
  frameworks?: { data: { id: string; name: string; type: string }[] | null; error: { code: string; message: string } | null };
}) {
  const linksQuery = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(responses.links),
    }),
  };
  const frameworksQuery = {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue(responses.frameworks ?? { data: [], error: null }),
    }),
  };

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'student_english_frameworks') return linksQuery;
    if (table === 'pedagogical_frameworks') return frameworksQuery;
    throw new Error(`tabla inesperada en el mock: ${table}`);
  });

  return {
    schema: vi.fn().mockReturnValue({ from }),
  } as unknown as StudentFrameworksSupabase;
}

describe('loadStudentFrameworks — ruta feliz (public → mia)', () => {
  it('resuelve los frameworks del alumno cuando ambas consultas responden bien', async () => {
    const supabase = fakeSupabase({
      links: { data: [{ framework_id: 'fw-1' }], error: null },
      frameworks: { data: [{ id: 'fw-1', name: 'Cambridge English', type: 'english' }], error: null },
    });

    const result = await loadStudentFrameworks(supabase, 'user-1');

    expect(result).toEqual({ frameworks: ['cambridge'], error: null });
  });

  it('sin frameworks asignados no consulta pedagogical_frameworks', async () => {
    const frameworksSelect = vi.fn();
    const supabase = {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'student_english_frameworks') {
            return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
          }
          return { select: frameworksSelect };
        }),
      }),
    } as unknown as StudentFrameworksSupabase;

    const result = await loadStudentFrameworks(supabase, 'user-1');

    expect(result).toEqual({ frameworks: [], error: null });
    expect(frameworksSelect).not.toHaveBeenCalled();
  });
});

describe('loadStudentFrameworks — ruta que falla y degrada (nunca rompe pantalla)', () => {
  it('student_english_frameworks falla → error con tabla, schema y code; frameworks vacío', async () => {
    const supabase = fakeSupabase({
      links: { data: null, error: { code: '42P17', message: 'permission denied' } },
    });

    const result = await loadStudentFrameworks(supabase, 'user-1');

    expect(result.frameworks).toEqual([]);
    expect(result.error).toEqual({
      table: 'student_english_frameworks',
      schema: 'public',
      code: '42P17',
      message: 'permission denied',
    });
  });

  it('pedagogical_frameworks (mia) falla → error con tabla, schema mia y code; frameworks vacío', async () => {
    const supabase = fakeSupabase({
      links: { data: [{ framework_id: 'fw-1' }], error: null },
      frameworks: { data: null, error: { code: 'PGRST205', message: "Could not find the table 'mia.pedagogical_frameworks'" } },
    });

    const result = await loadStudentFrameworks(supabase, 'user-1');

    expect(result.frameworks).toEqual([]);
    expect(result.error).toEqual({
      table: 'pedagogical_frameworks',
      schema: 'mia',
      code: 'PGRST205',
      message: "Could not find the table 'mia.pedagogical_frameworks'",
    });
  });
});
