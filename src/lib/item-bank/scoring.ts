export interface ScorableItem {
  id: string;
  correct_key: string;
}

export interface ClosedAnswer {
  item_id: string;
  selected_key: string;
}

export interface ClosedScoreResult {
  correct: number;
  total: number;
  correct_item_ids: string[];
  failed_item_ids: string[];
}

/**
 * @param items
 * @param answers
 */
export function scoreClosedAnswers(
  items: ScorableItem[],
  answers: ClosedAnswer[]
): ClosedScoreResult {
  const correctKeyByItemId = new Map(items.map(item => [item.id, item.correct_key]));

  const correctItemIds: string[] = [];
  const failedItemIds: string[] = [];

  for (const answer of answers) {
    const expectedKey = correctKeyByItemId.get(answer.item_id);
    if (expectedKey !== undefined && answer.selected_key === expectedKey) {
      correctItemIds.push(answer.item_id);
    } else {
      failedItemIds.push(answer.item_id);
    }
  }

  return {
    correct: correctItemIds.length,
    total: answers.length,
    correct_item_ids: correctItemIds,
    failed_item_ids: failedItemIds,
  };
}
