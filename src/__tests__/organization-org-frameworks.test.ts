import { describe, it, expect, vi } from 'vitest';
import { loadOrganizationFrameworks, type OrgFrameworksSupabase } from '@/lib/organization/org-frameworks';

function fakeSupabase(response: {
  data: { framework_id: string; pedagogical_frameworks: { name: string; type: string } | null }[] | null;
  error: { code: string; message: string } | null;
}) {
  const eq = vi.fn().mockResolvedValue(response);
  const from = vi.fn().mockImplementation((table: string) => {
    if (table !== 'organization_frameworks') throw new Error(`tabla inesperada en el mock: ${table}`);
    return { select: vi.fn().mockReturnValue({ eq }) };
  });
  const schema = vi.fn().mockReturnValue({ from });
  return { supabase: { schema } as unknown as OrgFrameworksSupabase, schema, eq };
}

describe('loadOrganizationFrameworks — el alumno hereda los exámenes del colegio', () => {
  it('devuelve los exámenes de inglés activados en el colegio', async () => {
    const { supabase, eq } = fakeSupabase({
      data: [
        { framework_id: 'fw-1', pedagogical_frameworks: { name: 'Cambridge English', type: 'english' } },
        { framework_id: 'fw-9', pedagogical_frameworks: { name: 'LOMLOE', type: 'curricular' } },
      ],
      error: null,
    });

    const result = await loadOrganizationFrameworks(supabase, 'org-1');

    expect(result).toEqual({ frameworks: ['cambridge'], error: null });
    expect(eq).toHaveBeenCalledWith('organization_id', 'org-1');
  });

  it('sin colegio no consulta y devuelve lista vacía', async () => {
    const { supabase, schema } = fakeSupabase({ data: [], error: null });

    const result = await loadOrganizationFrameworks(supabase, null);

    expect(result).toEqual({ frameworks: [], error: null });
    expect(schema).not.toHaveBeenCalled();
  });

  it('si la consulta falla degrada a lista vacía con el error descrito', async () => {
    const { supabase } = fakeSupabase({ data: null, error: { code: '42501', message: 'permission denied' } });

    const result = await loadOrganizationFrameworks(supabase, 'org-1');

    expect(result.frameworks).toEqual([]);
    expect(result.error).toEqual({
      table: 'organization_frameworks',
      schema: 'mia',
      code: '42501',
      message: 'permission denied',
    });
  });
});
