import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PLAN_TTL_MS = 3 * 60 * 60 * 1000;
const IV_BYTES = 12;
const TAG_BYTES = 16;

interface SealedEnvelope<T> {
  exp: number;
  plan: T;
}

function deriveKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHash('sha256').update(`bob-sealed-plan:${secret}`).digest();
}

/**
 * @template T
 * @param plan - server-side exercise plan, answer key included
 * @param userId - owner bound into the token
 * @returns opaque token the client hands back; the plan stays unreadable and untamperable
 */
export function sealPlan<T>(plan: T, userId: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const envelope: SealedEnvelope<T> = { exp: Date.now() + PLAN_TTL_MS, plan };
  const body = Buffer.concat([cipher.update(JSON.stringify(envelope), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/**
 * @template T
 * @param token - value produced by sealPlan
 * @param userId - owner expected in the token
 * @returns the plan, or null when the token is malformed, tampered with, expired or foreign
 */
export function unsealPlan<T>(token: string, userId: string): T | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(), raw.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
    const envelope = JSON.parse(text) as SealedEnvelope<T>;
    if (typeof envelope.exp !== 'number' || envelope.exp < Date.now()) return null;
    return envelope.plan;
  } catch {
    return null;
  }
}
