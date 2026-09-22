import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const GROUP_ROW = {
  id: 'group-1',
  exam: 'toefl',
  skill: 'listening',
  cefr_level: 'b1',
  difficulty: 2,
  purpose: 'practice',
  module_code: null,
  stimulus_text: null,
  stimulus_audio_url: null,
  stimulus_image_url: null,
  source: 'official',
  source_ref: 'Referencias/TOELF/toefl-full-length-practice-test1.pdf p.12',
  status: 'published',
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-05-16T00:00:00.000Z',
};

const ITEM_ROW = {
  id: 'item-1',
  framework: 'toefl',
  exam_part: 'listen_choose_response',
  cefr_level: 'b1',
  variant_id: 'lcr-01',
  stimulus_audio_url: null,
  stimulus_text: null,
  stimulus_image_url: null,
  question: 'What does the speaker mean?',
  options: [{ key: 'A', label: 'Option A' }],
  correct_key: 'A',
  explanation: null,
  source: 'official',
  group_id: 'group-1',
  group_order: 1,
};

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.in = vi.fn().mockReturnValue(query);
  query.order = vi.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}));

describe('fetchGroups', () => {
  it('returns ok:true with rows on success', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const from = vi.fn().mockReturnValue(makeQuery({ data: [GROUP_ROW], error: null }));
    vi.mocked(createSupabaseServer).mockResolvedValue({ from } as never);

    const { fetchGroups } = await import('@/actions/item-bank/repository');
    const result = await fetchGroups({ exam: 'toefl' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('group-1');
    }
    expect(from).toHaveBeenCalledWith('item_groups');
  });

  it('returns ok:false with db_error on Supabase error', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const from = vi.fn().mockReturnValue(makeQuery({ data: null, error: { message: 'boom' } }));
    vi.mocked(createSupabaseServer).mockResolvedValue({ from } as never);

    const { fetchGroups } = await import('@/actions/item-bank/repository');
    const result = await fetchGroups();

    expect(result).toEqual({ ok: false, code: 'db_error' });
  });
});

describe('fetchGroupItems', () => {
  it('returns ok:true with parsed items for a batch of group ids', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const from = vi.fn().mockReturnValue(makeQuery({ data: [ITEM_ROW], error: null }));
    vi.mocked(createSupabaseServer).mockResolvedValue({ from } as never);

    const { fetchGroupItems } = await import('@/actions/item-bank/repository');
    const result = await fetchGroupItems(['group-1', 'group-2']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].correct_key).toBe('A');
    }
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('returns ok:true with an empty array without querying for empty groupIds', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const from = vi.fn();
    vi.mocked(createSupabaseServer).mockResolvedValue({ from } as never);

    const { fetchGroupItems } = await import('@/actions/item-bank/repository');
    const result = await fetchGroupItems([]);

    expect(result).toEqual({ ok: true, data: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it('discards rows that fail schema validation instead of throwing', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const invalidRow = { ...ITEM_ROW, options: 'not-an-array' };
    const from = vi.fn().mockReturnValue(makeQuery({ data: [invalidRow], error: null }));
    vi.mocked(createSupabaseServer).mockResolvedValue({ from } as never);

    const { fetchGroupItems } = await import('@/actions/item-bank/repository');
    const result = await fetchGroupItems(['group-1']);

    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe('fetchOpenTasks', () => {
  it('returns ok:false with db_error on Supabase error', async () => {
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    const from = vi.fn().mockReturnValue(makeQuery({ data: null, error: { message: 'boom' } }));
    vi.mocked(createSupabaseServer).mockResolvedValue({ from } as never);

    const { fetchOpenTasks } = await import('@/actions/item-bank/repository');
    const result = await fetchOpenTasks({ skill: 'writing' });

    expect(result).toEqual({ ok: false, code: 'db_error' });
  });
});
