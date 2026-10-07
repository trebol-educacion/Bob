export type ActivityErrorKind = 'no_content' | 'retryable' | 'fatal';

/**
 * @param code - ActionFailure code
 * @param retryable - ActionFailure retryable flag
 * @returns kind driving copy and actions
 */
export function classifyActivityError(code?: string | null, retryable?: boolean | null): ActivityErrorKind {
  if (code === 'no_content') return 'no_content';
  return retryable === false ? 'fatal' : 'retryable';
}
