import 'server-only';

import { createSupabaseServer } from '@/lib/supabase/server';
import { ClosedItemSchema } from '@/lib/types/practice';
import type { BankItem, ItemGroup, ItemBankExam, ItemBankPurpose, ItemBankSkill, OpenTask } from '@/lib/item-bank/types';

export type ItemBankErrorCode = 'unauthenticated' | 'db_error' | 'invalid_input';

export type ItemBankResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ItemBankErrorCode };

export interface FetchGroupsFilter {
  exam?: ItemBankExam;
  skill?: ItemBankSkill;
  cefr_level?: string | null;
  purpose?: ItemBankPurpose;
  module_code?: string | null;
}

export interface FetchOpenTasksFilter {
  exam?: ItemBankExam;
  skill?: Extract<ItemBankSkill, 'writing' | 'speaking'>;
  cefr_level?: string | null;
  purpose?: ItemBankPurpose;
}

/** @param filter */
export async function fetchGroups(filter: FetchGroupsFilter = {}): Promise<ItemBankResult<ItemGroup[]>> {
  try {
    const supabase = await createSupabaseServer();

    let query = supabase.from('item_groups').select('*');
    if (filter.exam !== undefined) query = query.eq('exam', filter.exam);
    if (filter.skill !== undefined) query = query.eq('skill', filter.skill);
    if (filter.cefr_level !== undefined) query = query.eq('cefr_level', filter.cefr_level);
    if (filter.purpose !== undefined) query = query.eq('purpose', filter.purpose);
    if (filter.module_code !== undefined) query = query.eq('module_code', filter.module_code);

    const { data, error } = await query;
    if (error) {
      console.error('[fetchGroups] Supabase error:', error.message);
      return { ok: false, code: 'db_error' };
    }

    return { ok: true, data: (data ?? []) as ItemGroup[] };
  } catch (err) {
    console.error('[fetchGroups] Unexpected error:', err instanceof Error ? err.message : err);
    return { ok: false, code: 'db_error' };
  }
}

/** @param groupIds */
export async function fetchGroupItems(groupIds: string[]): Promise<ItemBankResult<BankItem[]>> {
  if (groupIds.length === 0) {
    return { ok: true, data: [] };
  }

  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from('closed_items')
      .select('*')
      .in('group_id', groupIds)
      .order('group_order', { ascending: true });

    if (error) {
      console.error('[fetchGroupItems] Supabase error:', error.message);
      return { ok: false, code: 'db_error' };
    }

    const items: BankItem[] = [];
    for (const row of data ?? []) {
      const parsed = ClosedItemSchema.safeParse(row);
      if (parsed.success) {
        items.push(parsed.data);
      } else {
        console.warn('[fetchGroupItems] Discarding invalid row:', row.id, parsed.error.issues);
      }
    }

    return { ok: true, data: items };
  } catch (err) {
    console.error('[fetchGroupItems] Unexpected error:', err instanceof Error ? err.message : err);
    return { ok: false, code: 'db_error' };
  }
}

/** @param filter */
export async function fetchOpenTasks(filter: FetchOpenTasksFilter = {}): Promise<ItemBankResult<OpenTask[]>> {
  try {
    const supabase = await createSupabaseServer();

    let query = supabase.from('open_tasks').select('*');
    if (filter.exam !== undefined) query = query.eq('exam', filter.exam);
    if (filter.skill !== undefined) query = query.eq('skill', filter.skill);
    if (filter.cefr_level !== undefined) query = query.eq('cefr_level', filter.cefr_level);
    if (filter.purpose !== undefined) query = query.eq('purpose', filter.purpose);

    const { data, error } = await query;
    if (error) {
      console.error('[fetchOpenTasks] Supabase error:', error.message);
      return { ok: false, code: 'db_error' };
    }

    return { ok: true, data: (data ?? []) as OpenTask[] };
  } catch (err) {
    console.error('[fetchOpenTasks] Unexpected error:', err instanceof Error ? err.message : err);
    return { ok: false, code: 'db_error' };
  }
}
