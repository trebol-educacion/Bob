import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fetchGroups = vi.fn();
const fetchGroupItems = vi.fn();
const fetchPublishedItems = vi.fn();
const recentGroupIds = vi.fn();

vi.mock('@/actions/item-bank/repository', () => ({
  fetchGroups: (...a: unknown[]) => fetchGroups(...a),
  fetchGroupItems: (...a: unknown[]) => fetchGroupItems(...a),
  fetchPublishedItems: (...a: unknown[]) => fetchPublishedItems(...a),
}));
vi.mock('@/lib/item-bank/recent-groups', () => ({
  recentGroupIds: (...a: unknown[]) => recentGroupIds(...a),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));

import { pickContent, type ContentQuery } from '@/lib/item-bank/content-source';

const group = (id: string, topic = 'x') => ({ id, metadata: { topic } });
const item = (id: string) => ({ id });

const QUERY: ContentQuery = {
  framework: 'fce',
  cefr: 'b2',
  examPart: 'fce_reading_part1',
  purpose: 'practice',
  skill: 'reading',
  userId: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  recentGroupIds.mockResolvedValue([]);
  fetchGroupItems.mockResolvedValue({ ok: true, data: [item('i1')] });
});

describe('pickContent', () => {
  it('queries published groups of the requested framework, level, part, purpose and skill', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1')] });
    const result = await pickContent(QUERY);
    expect(fetchGroups).toHaveBeenCalledWith({
      exam: 'fce',
      skill: 'reading',
      cefr_level: 'b2',
      exam_part: 'fce_reading_part1',
      purpose: 'practice',
      status: 'published',
    });
    expect(result).toMatchObject({ ok: true, data: { kind: 'group', group: { id: 'g1' } } });
  });

  it('avoids the groups seen recently', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1'), group('g2')] });
    recentGroupIds.mockResolvedValue(['g1']);
    for (let i = 0; i < 10; i++) {
      const result = await pickContent(QUERY);
      expect(result).toMatchObject({ data: { group: { id: 'g2' } } });
    }
  });

  it('reuses a seen group when every group was seen', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1')] });
    recentGroupIds.mockResolvedValue(['g1']);
    expect(await pickContent(QUERY)).toMatchObject({ ok: true, data: { group: { id: 'g1' } } });
  });

  it('prefers the group of the requested topic and falls back to any', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1', 'Cities'), group('g2', 'Museums')] });
    expect(await pickContent({ ...QUERY, topic: ' museums ' })).toMatchObject({ data: { group: { id: 'g2' } } });
    const other = await pickContent({ ...QUERY, topic: 'Unknown' });
    expect(other.ok).toBe(true);
  });

  it('returns no_content when the bank is empty and only groups are wanted', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [] });
    expect(await pickContent({ ...QUERY, groupsOnly: true })).toEqual({ ok: false, code: 'no_content', retryable: false });
    expect(fetchPublishedItems).not.toHaveBeenCalled();
  });

  it('falls back to loose published items limited by count', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [] });
    fetchPublishedItems.mockResolvedValue({ ok: true, data: [item('a'), item('b'), item('c')] });
    const result = await pickContent({ ...QUERY, examPart: 'fce_listening_part1', skill: 'listening', count: 2 });
    expect(fetchPublishedItems).toHaveBeenCalledWith({
      framework: 'cambridge',
      exam_part: 'fce_listening_part1',
      cefr_level: 'b2',
      skill: 'listening',
    });
    expect(result.ok && result.data.kind === 'items' && result.data.items).toHaveLength(2);
  });

  it('returns no_content when there are no loose items either', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [] });
    fetchPublishedItems.mockResolvedValue({ ok: true, data: [] });
    expect(await pickContent(QUERY)).toMatchObject({ ok: false, code: 'no_content' });
  });

  it('reports a retryable db error', async () => {
    fetchGroups.mockResolvedValue({ ok: false, code: 'db_error' });
    expect(await pickContent(QUERY)).toEqual({ ok: false, code: 'db_error', retryable: true });
  });

  it('accepts a group without items only for item-less parts', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1')] });
    fetchGroupItems.mockResolvedValue({ ok: true, data: [] });
    expect(await pickContent({ ...QUERY, itemless: true })).toMatchObject({ ok: true, data: { items: [] } });
  });

  it('reports no_content when the chosen group has no items', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1')] });
    fetchGroupItems.mockResolvedValue({ ok: true, data: [] });
    expect(await pickContent(QUERY)).toMatchObject({ ok: false, code: 'no_content' });
  });
});

describe('pickContent for placement', () => {
  const PLACEMENT: ContentQuery = {
    framework: 'cefr',
    cefr: 'a1',
    examPart: 'placement_reading',
    purpose: 'placement',
    skill: 'reading',
    userId: 'u1',
    groupsOnly: true,
  };

  it('only queries placement groups and never falls back to loose practice items', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [] });
    const result = await pickContent(PLACEMENT);
    expect(fetchGroups).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'placement', exam: 'cefr', exam_part: 'placement_reading' }));
    expect(fetchPublishedItems).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: 'no_content', retryable: false });
  });

  it('skips the groups already answered in the attempt', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1'), group('g2')] });
    for (let i = 0; i < 10; i++) {
      const result = await pickContent({ ...PLACEMENT, excludeGroupIds: ['g1'] });
      expect(result).toMatchObject({ ok: true, data: { group: { id: 'g2' } } });
    }
  });

  it('reports no_content when every group of the level was already answered', async () => {
    fetchGroups.mockResolvedValue({ ok: true, data: [group('g1')] });
    const result = await pickContent({ ...PLACEMENT, excludeGroupIds: ['g1'] });
    expect(result).toEqual({ ok: false, code: 'no_content', retryable: false });
  });
});
