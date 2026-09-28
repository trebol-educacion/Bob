import type { BankItem, ItemGroup, PublicBankItem, PublicItemGroup } from './types';

/** @param item */
export function toPublicItem(item: BankItem): PublicBankItem {
  const { correct_key: _correct_key, explanation: _explanation, ...publicItem } = item;
  return publicItem;
}

/** @param group */
export function toPublicGroup(group: ItemGroup): PublicItemGroup {
  const { reviewed_by: _reviewed_by, reviewed_at: _reviewed_at, source_ref: _source_ref, ...publicGroup } = group;
  return publicGroup;
}
