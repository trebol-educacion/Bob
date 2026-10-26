'use server';

import { runPracticeTurn, type PracticeTurnResult } from '@/lib/practice/chat-turn';
import type { ChatMessage } from '@/actions/gemini/types';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode } from '@/lib/practice/types';

/**
 * @param userText - text typed by the student
 * @param history - conversation so far
 * @param topic - seed topic of the session
 * @param level - effective CEFR level
 * @param mode - practice activity, selects the turn prompt
 * @returns evaluation, Bob reply and criteria bands (pronunciation is always null for text)
 */
export async function practiceChatTextAction(
  userText: string,
  history: ChatMessage[],
  topic: string,
  level: CefrLevel,
  mode: PracticeActivityMode
): Promise<PracticeTurnResult> {
  return runPracticeTurn({
    mode,
    history,
    studentParts: [{ text: userText }],
    hasAudio: false,
    fallbackTranscript: userText,
    topic,
    level,
  });
}

/**
 * @param audioBase64 - recorded turn
 * @param mimeType - audio mime type
 * @param history - conversation so far
 * @param topic - seed topic of the session
 * @param level - effective CEFR level
 * @param mode - practice activity, selects the turn prompt
 * @returns evaluation, Bob reply and criteria bands including pronunciation
 */
export async function practiceChatAudioAction(
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[],
  topic: string,
  level: CefrLevel,
  mode: PracticeActivityMode
): Promise<PracticeTurnResult> {
  return runPracticeTurn({
    mode,
    history,
    studentParts: [{ inlineData: { data: audioBase64, mimeType } }],
    hasAudio: true,
    fallbackTranscript: '',
    topic,
    level,
  });
}
