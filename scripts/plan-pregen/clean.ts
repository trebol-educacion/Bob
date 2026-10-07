import { stripDashes } from '../../src/lib/text';

/**
 * @template T
 * @param value any JSON-like plan
 * @returns deep copy with typographic dashes removed from every string
 */
export function stripAllDashes<T>(value: T): T {
  if (typeof value === 'string') return stripDashes(value) as T;
  if (Array.isArray(value)) return value.map((entry) => stripAllDashes(entry)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripAllDashes(v)])) as T;
  }
  return value;
}
