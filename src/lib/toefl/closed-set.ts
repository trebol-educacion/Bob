export const CLOSED_PLAN_KIND = 'closed_plan';
export const CLOSED_ANSWER_KIND = 'closed_answer';
export const CLOSED_EVALUATION_KIND = 'closed_set_evaluation';

export type ClosedMatch = 'key' | 'sentence';

export interface ClosedEntry {
  id: string;
  selected: string;
  expected: string;
  explanation?: string | null;
  match: ClosedMatch;
}

export interface ClosedEntryResult {
  id: string;
  selected: string;
  expected: string;
  explanation: string | null;
  correct: boolean;
}

export interface RestorableClosedMessage {
  role: string;
  msg_type: string;
  content_json?: unknown;
}

function normalizeSentence(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isCorrect(entry: ClosedEntry): boolean {
  if (entry.match === 'sentence') return normalizeSentence(entry.selected) === normalizeSentence(entry.expected);
  return entry.selected === entry.expected;
}

/**
 * @param entries - answers with their expected value
 * @returns deterministic result per entry
 */
export function scoreClosedEntries(entries: ClosedEntry[]): ClosedEntryResult[] {
  return entries.map((entry) => ({
    id: entry.id,
    selected: entry.selected,
    expected: entry.expected,
    explanation: entry.explanation ?? null,
    correct: isCorrect(entry),
  }));
}

/**
 * @param results - scored entries
 * @returns final evaluation payload graded by hits over total
 */
export function buildClosedEvaluation(results: ClosedEntryResult[]): Record<string, unknown> {
  return {
    kind: CLOSED_EVALUATION_KIND,
    score: results.filter((result) => result.correct).length,
    score_max: results.length,
    results,
  };
}

function readResult(value: unknown): ClosedEntryResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.correct !== 'boolean' || typeof record.selected !== 'string' || typeof record.expected !== 'string') return null;
  return {
    id: typeof record.id === 'string' ? record.id : '',
    selected: record.selected,
    expected: record.expected,
    explanation: typeof record.explanation === 'string' ? record.explanation : null,
    correct: record.correct,
  };
}

/**
 * @param messages - stored messages of a closed-set session
 * @returns graded results from the final evaluation, or from legacy per-item evaluations; null when none
 */
export function restoreClosedSet(messages: RestorableClosedMessage[]): ClosedEntryResult[] | null {
  const legacy: ClosedEntryResult[] = [];
  for (const message of messages) {
    if (message.role !== 'bob' || message.msg_type !== 'evaluation') continue;
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    if (json.kind === CLOSED_EVALUATION_KIND && Array.isArray(json.results)) {
      const results = json.results.map(readResult);
      if (results.every((result): result is ClosedEntryResult => result !== null)) return results;
    }
    if (json.kind === 'closed') {
      const legacyResult = readResult(json);
      if (legacyResult) legacy.push(legacyResult);
    }
  }
  return legacy.length > 0 ? legacy : null;
}
