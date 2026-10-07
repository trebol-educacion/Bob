export type ActionSuccess<T> = { ok: true; data: T };

export type ActionFailure = { ok: false; code: string; retryable: boolean };

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/**
 * @param data - success payload
 */
export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

/**
 * @param code - stable machine-readable failure code
 * @param retryable - whether the caller may retry
 */
export function fail(code: string, retryable = false): ActionFailure {
  return { ok: false, code, retryable };
}

/**
 * @param result - action result to narrow
 */
export function isFailure<T>(result: ActionResult<T>): result is ActionFailure {
  return result.ok === false;
}
