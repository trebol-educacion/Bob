import { describe, it, expect } from 'vitest';
import { config } from '@/middleware';
import { isServiceAuthRoute } from '@/lib/auth/service-auth-routes';

const pattern = new RegExp(`^${config.matcher[0]}$`);

describe('middleware matcher', () => {
  it.each(['/', '/login', '/auth/confirm', '/api/practice/initial-turn', '/progress'])('guards %s', (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each([
    '/_next/static/chunks/a.js',
    '/_next/image',
    '/api/usage',
    '/favicon.ico',
    '/bob_avatar.png',
    '/audio/clip.mp3',
    '/fonts/a.woff2',
  ])('skips %s', (path) => {
    expect(pattern.test(path)).toBe(false);
  });

  it.each(['/api/challenge/pregenerate', '/api/b2/pregenerate'])('deja pasar sin sesión %s, que se autentica por token', (path) => {
    expect(isServiceAuthRoute(path)).toBe(true);
  });

  it.each(['/', '/api/practice/initial-turn', '/api/b2'])('exige sesión en %s', (path) => {
    expect(isServiceAuthRoute(path)).toBe(false);
  });
});
