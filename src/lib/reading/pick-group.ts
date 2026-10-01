/**
 * @param groups
 * @param recentIds
 * @param random
 * @returns a group not seen recently, or any group when all were seen
 */
export function pickGroup<T extends { id: string }>(
  groups: T[],
  recentIds: readonly string[],
  random: () => number = Math.random
): T | null {
  if (groups.length === 0) return null;
  const unseen = groups.filter((group) => !recentIds.includes(group.id));
  const pool = unseen.length > 0 ? unseen : groups;
  return pool[Math.floor(random() * pool.length)] ?? null;
}
