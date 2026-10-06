import type { JudgeFn, Verdict } from '../b2-pregen/semantic-judge';
import type { PlanPart } from './types';

export interface PlanReviewResult<P> {
  plan: P;
  errors: string[];
}

export type PlanReview<P> = (plan: P) => Promise<PlanReviewResult<P>>;

function verdictErrors(kind: string, verdict: Verdict): string[] {
  const label = `item ${verdict.number}`;
  const detail = verdict.issue ? `: ${verdict.issue}` : '';
  if (!verdict.key_correct) return [`${label}: the answer key is not correct or not grammatical${detail}`];
  if (kind === 'comprehension' && verdict.other_correct.length > 0) {
    return [`${label}: option(s) ${verdict.other_correct.join(', ')} also fit, the key must be the ONLY correct answer${detail}`];
  }
  return [];
}

/**
 * @param part
 * @param judge LLM judge, or null to run only the deterministic rules
 * @returns review that runs the part rules and then the judge on the items the part exposes
 */
export function createPlanReview<P>(part: PlanPart<P>, judge: JudgeFn | null): PlanReview<P> {
  return async (plan) => {
    const errors = part.rules ? part.rules(plan) : [];
    const request = part.judge?.(plan) ?? null;
    if (!request || !judge) return { plan, errors };
    const verdicts = await judge(request.kind, request.input);
    const items = (request.input as { items?: { number: number }[] }).items ?? [];
    const missing = items.filter((item) => !verdicts.some((v) => v.number === item.number)).map((item) => item.number);
    const judgeErrors = [
      ...verdicts.flatMap((v) => verdictErrors(request.kind, v)),
      ...(missing.length > 0 ? [`the reviewer did not return a verdict for items ${missing.join(', ')}`] : []),
    ];
    return { plan, errors: [...errors, ...judgeErrors] };
  };
}
