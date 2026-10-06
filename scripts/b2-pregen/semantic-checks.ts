import type { Payload } from './schemas';
import { JUDGE_KIND, buildJudgeInput, type JudgeFn, type Verdict } from './semantic-judge';
import { ruleIssues, withContractionVariants, type ReviewContext } from './semantic-rules';

export interface ReviewResult {
  payload: Payload;
  errors: string[];
}

const MAX_ACCEPTED_WORDS = 5;

function wordCount(value: string): number {
  return value.trim().split(/\s+/).length;
}

function verdictErrors(kind: string, verdict: Verdict): string[] {
  const label = `item ${verdict.number}`;
  const detail = verdict.issue ? `: ${verdict.issue}` : '';
  if (!verdict.key_correct) return [`${label}: the answer key is not correct or not grammatical${detail}`];
  if (kind !== 'open' && kind !== 'transform' && verdict.other_correct.length > 0) {
    return [`${label}: option(s) ${verdict.other_correct.join(', ')} also fit, the key must be the ONLY correct answer${detail}`];
  }
  return verdict.issue && kind === 'transform' ? [`${label}${detail}`] : [];
}

function mergeAccepted(payload: Payload, verdicts: Verdict[], kind: string): Payload {
  if (kind !== 'open' && kind !== 'transform') return payload;
  const items = payload.items.map((item, index) => {
    const current = Array.isArray(item.metadata.accepted) ? (item.metadata.accepted as string[]) : [];
    const number = Number(item.metadata.number) || index + 1;
    const extra = verdicts.find((v) => v.number === number)?.extra_accepted ?? [];
    const extraClean = extra.map((v) => v.trim().toLowerCase()).filter((v) => v && wordCount(v) <= MAX_ACCEPTED_WORDS);
    const merged = withContractionVariants([...new Set([...current, ...extraClean])], MAX_ACCEPTED_WORDS);
    return { ...item, metadata: { ...item.metadata, accepted: merged } };
  });
  return { ...payload, items };
}

/**
 * @param examPart
 * @param payload structurally valid payload
 * @param context titles already published for the part
 * @param judge LLM judge, or null to run only the deterministic rules
 * @returns payload with enriched accepted[] and the issues to send back to the generator
 */
export async function reviewPayload(
  examPart: string,
  payload: Payload,
  context: ReviewContext,
  judge: JudgeFn | null,
): Promise<ReviewResult> {
  const errors = ruleIssues(examPart, payload, context);
  const kind = JUDGE_KIND[examPart];
  if (!kind || !judge) return { payload, errors };
  const verdicts = await judge(kind, buildJudgeInput(examPart, payload));
  const judged = payload.items.map((item, index) => Number(item.metadata.number) || index + 1);
  const missing = judged.filter((n) => !verdicts.some((v) => v.number === n));
  const judgeErrors = [
    ...verdicts.flatMap((v) => verdictErrors(kind, v)),
    ...(missing.length > 0 ? [`the reviewer did not return a verdict for items ${missing.join(', ')}`] : []),
  ];
  const hasHardError = judgeErrors.length > 0;
  return {
    payload: hasHardError ? payload : mergeAccepted(payload, verdicts, kind),
    errors: [...errors, ...judgeErrors],
  };
}
