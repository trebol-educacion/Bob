import { describe, it, expect } from 'vitest';
import { config } from '@/middleware';

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
});
