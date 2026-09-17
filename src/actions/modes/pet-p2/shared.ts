/**
 * PET B1 Part 2 — topics and parse helpers shared by the actions.
 */

import { z } from 'zod';

export const B1_PICTURE_TOPICS = [
  'Free Time',
  'Entertainment',
  'Health',
  'Relationships',
  'Transport',
  'Services',
  'Home',
  'Housework',
] as const;

export function pickRandomTopic(): string {
  return B1_PICTURE_TOPICS[Math.floor(Math.random() * B1_PICTURE_TOPICS.length)];
}

export function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

