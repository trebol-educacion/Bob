import 'server-only';

import { fetchGroupItems, fetchGroups, fetchPublishedItems } from '@/actions/item-bank/repository';
import { fail, ok, type ActionResult } from '@/lib/result';
import { pickGroup } from '@/lib/reading/pick-group';
import { createSupabaseServer } from '@/lib/supabase/server';
import { recentGroupIds } from './recent-groups';
import type { BankItem, ItemBankExam, ItemBankPurpose, ItemBankSkill, ItemGroup } from './types';

export interface ContentQuery {
  framework: ItemBankExam;
  cefr: string | null;
  examPart: string;
  purpose: ItemBankPurpose;
  skill: ItemBankSkill;
  userId?: string;
  count?: number;
  topic?: string;
  groupsOnly?: boolean;
  itemless?: boolean;
}

export type PickedContent =
  | { kind: 'group'; group: ItemGroup; items: BankItem[] }
  | { kind: 'items'; items: BankItem[] };

const ITEM_FRAMEWORK: Partial<Record<ItemBankExam, string>> = {
  ket: 'cambridge',
  pet: 'cambridge',
  fce: 'cambridge',
  toefl: 'toefl',
  cefr: 'cefr',
};

function shuffled<T>(values: T[], random: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function preferTopic(groups: ItemGroup[], topic: string | undefined): ItemGroup[] {
  if (!topic) return groups;
  const wanted = topic.trim().toLowerCase();
  const matching = groups.filter((g) => String(g.metadata.topic ?? '').trim().toLowerCase() === wanted);
  return matching.length > 0 ? matching : groups;
}

async function resolveUserId(userId: string | undefined): Promise<string | null> {
  if (userId) return userId;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function pickFromGroups(query: ContentQuery, userId: string | null): Promise<ActionResult<PickedContent> | null> {
  const groups = await fetchGroups({
    exam: query.framework,
    skill: query.skill,
    cefr_level: query.cefr,
    exam_part: query.examPart,
    purpose: query.purpose,
    status: 'published',
  });
  if (!groups.ok) return fail('db_error', true);
  if (groups.data.length === 0) return null;

  const recent = userId ? await recentGroupIds(userId, query.examPart) : [];
  const group = pickGroup(preferTopic(groups.data, query.topic), recent);
  if (!group) return null;

  const items = await fetchGroupItems([group.id]);
  if (!items.ok) return fail('db_error', true);
  if (items.data.length === 0 && !query.itemless) return fail('no_content');
  return ok({ kind: 'group', group, items: items.data });
}

async function pickFromItems(query: ContentQuery): Promise<ActionResult<PickedContent>> {
  const framework = ITEM_FRAMEWORK[query.framework];
  if (!framework) return fail('no_content');
  const items = await fetchPublishedItems({
    framework,
    exam_part: query.examPart,
    cefr_level: query.cefr,
    skill: query.skill,
  });
  if (!items.ok) return fail('db_error', true);
  if (items.data.length === 0) return fail('no_content');
  const pool = shuffled(items.data, Math.random);
  return ok({ kind: 'items', items: query.count ? pool.slice(0, query.count) : pool });
}

/**
 * @param query framework, level, part, purpose and skill of the content
 * @returns a published group with its items, or loose items; `no_content` when the bank has none
 */
export async function pickContent(query: ContentQuery): Promise<ActionResult<PickedContent>> {
  const userId = await resolveUserId(query.userId);
  const fromGroups = await pickFromGroups(query, userId);
  if (fromGroups) return fromGroups;
  if (query.groupsOnly) return fail('no_content');
  return pickFromItems(query);
}
