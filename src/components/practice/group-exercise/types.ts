import type { StoredMessage } from '@/actions/messages';
import type { MatchingReview } from '@/components/practice/matching';
import type { GroupSubmitResult, GroupItemResult } from '@/lib/item-bank/group-types';

export interface GroupPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

export function resultsByItem(result: GroupSubmitResult | null): Record<string, GroupItemResult> {
  const byItem: Record<string, GroupItemResult> = {};
  for (const entry of result?.results ?? []) byItem[entry.item_id] = entry;
  return byItem;
}

export function toMatchingReview(result: GroupSubmitResult | null): Record<string, MatchingReview> {
  return Object.fromEntries(
    Object.entries(resultsByItem(result)).map(([id, entry]) => [
      id,
      { isCorrect: entry.is_correct, correctKey: entry.correct_key },
    ]),
  );
}
