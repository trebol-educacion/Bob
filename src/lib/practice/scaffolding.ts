export const HINT_UNLOCK_PLAY_COUNT = 2;

/** @param playCount number */
export function isHintAvailable(playCount: number): boolean {
  return playCount >= HINT_UNLOCK_PLAY_COUNT;
}

export interface ScaffoldingUsage {
  hintUsed: boolean;
  modelAnswerUsed: boolean;
}

/** @param usage Partial<ScaffoldingUsage> */
export function markAssistedTurn(usage: Partial<ScaffoldingUsage>): ScaffoldingUsage {
  return {
    hintUsed: Boolean(usage.hintUsed),
    modelAnswerUsed: Boolean(usage.modelAnswerUsed),
  };
}

/** @param usage ScaffoldingUsage */
export function wasTurnAssisted(usage: ScaffoldingUsage): boolean {
  return usage.hintUsed || usage.modelAnswerUsed;
}
