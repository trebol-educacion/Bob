/**
 * FCE B2 Part 2 — topics and parse helpers shared by the actions.
 */

import { z } from 'zod';

export const B2_PICTURE_TOPICS = [
  'Sport',
  'Travel',
  'Work',
  'Family',
  'Education',
  'Technology',
  'Environment',
  'Free time',
  'Health',
  'Food',
] as const;

export function pickRandomTopic(): string {
  return B2_PICTURE_TOPICS[Math.floor(Math.random() * B2_PICTURE_TOPICS.length)];
}

export function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

