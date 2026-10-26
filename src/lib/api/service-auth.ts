import { timingSafeEqual } from 'node:crypto';

/**
 * @param req Request
 * @returns whether the bearer token equals SUPABASE_SERVICE_ROLE_KEY
 */
export function isServiceRoleRequest(req: Request): boolean {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !token) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
