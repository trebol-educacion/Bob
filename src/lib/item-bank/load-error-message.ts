const NO_CONTENT = 'There are no exercises available for this activity yet. Go back and try another one.';
const LOAD_FAILED = 'We could not load this exercise. Please try again.';

/**
 * @param code failure code of a bank read
 * @returns message shown to the student
 */
export function loadErrorMessage(code: string): string {
  return code === 'no_content' ? NO_CONTENT : LOAD_FAILED;
}
