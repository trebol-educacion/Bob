import type { Speaker } from '../b2-pregen/tts';
import { FEMALE_VOICES, MALE_VOICES, SOLO_VOICES, dialogueVoices } from './assets';

export interface Turn {
  speaker: 'M' | 'W';
  line: string;
}

export interface SpokenText {
  text: string;
  speakers: Speaker[];
}

/**
 * @param turns alternating M and W turns
 * @param slot rotation seed for the voices
 * @returns labelled text and the matching voices; one voice when a single turn
 */
export function spokenTurns(turns: Turn[], slot: number): SpokenText {
  const speakers = new Set(turns.map((t) => t.speaker));
  if (speakers.size === 1) {
    const only = turns[0].speaker;
    const voice = (only === 'M' ? MALE_VOICES : FEMALE_VOICES)[slot % 2];
    return { text: turns.map((t) => t.line).join(' '), speakers: [{ name: 'Speaker', voice }] };
  }
  const text = turns.map((t) => `${t.speaker === 'M' ? 'Man' : 'Woman'}: ${t.line}`).join('\n');
  return { text, speakers: dialogueVoices(slot) };
}

/**
 * @param transcript free text that may carry Man/Woman or M/W labels
 * @param slot rotation seed for the voices
 * @returns text and voices matching the labels found in the transcript
 */
export function spokenTranscript(transcript: string, slot: number): SpokenText {
  const relabelled = transcript.replace(/^M:/gm, 'Man:').replace(/^W:/gm, 'Woman:');
  if (/^Man:/m.test(relabelled) && /^Woman:/m.test(relabelled)) {
    return { text: relabelled, speakers: dialogueVoices(slot) };
  }
  const clean = relabelled.replace(/^(Man|Woman|Speaker):\s*/gm, '');
  return { text: clean, speakers: [{ name: 'Speaker', voice: SOLO_VOICES[slot % SOLO_VOICES.length] }] };
}

/**
 * @param turns
 * @returns plain transcript with Man and Woman labels
 */
export function labelledTranscript(turns: Turn[]): string {
  return turns.map((t) => `${t.speaker === 'M' ? 'Man' : 'Woman'}: ${t.line}`).join('\n');
}
