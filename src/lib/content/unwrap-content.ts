import type { ActionResult } from '@/lib/result';

export const NO_CONTENT_MESSAGE = 'There are no exercises available for this part yet. Go back and try another activity.';
export const LOAD_FAILED_MESSAGE = 'We could not load this exercise. Go back and try again.';

/**
 * @param result bank read result
 * @returns the data, or throws the user-facing message for the host hook that renders its error state
 */
export function unwrapContent<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(result.code === 'no_content' ? NO_CONTENT_MESSAGE : LOAD_FAILED_MESSAGE);
}
