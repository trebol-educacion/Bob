import type { SlotContext } from '../types';
import { duplicateIssues, keyDistributionIssues, wordsIn } from '../rules';

export const PET_LISTENING_TOPICS = [
  'a school trip and a club meeting',
  'sport, a match and a training session',
  'a holiday, a hotel and a journey',
  'shopping, a market and a birthday present',
  'a part-time job and a new colleague',
  'a concert, a film or a festival',
  'cooking, a restaurant and a food delivery',
  'a new phone, an online course and computer problems',
];

type Turn = { speaker: 'M' | 'W'; line: string };

/**
 * @param turns conversation turns
 * @returns text with Man and Woman labels as the TTS expects
 */
export function dialogueText(turns: Turn[]): string {
  return turns.map((turn) => `${turn.speaker === 'M' ? 'Man' : 'Woman'}: ${turn.line}`).join('\n');
}

/**
 * @param turns
 * @param label
 * @returns issues when speakers do not alternate or one never speaks
 */
export function turnIssues(turns: Turn[], label: string): string[] {
  const issues: string[] = [];
  if (new Set(turns.map((turn) => turn.speaker)).size < 2) issues.push(`${label}: both Man and Woman must speak`);
  if (turns.some((turn, index) => index > 0 && turns[index - 1].speaker === turn.speaker)) {
    issues.push(`${label}: speakers must alternate`);
  }
  return issues;
}

/**
 * @param items numbered multiple-choice items
 * @param label
 * @returns issues for numbering, key spread, repeated questions and repeated options
 */
export function choiceIssues(
  items: { number: number; question: string; options: { A: string; B: string; C: string }; answer: string }[],
  label: string,
): string[] {
  const issues = [
    ...keyDistributionIssues(items.map((item) => item.answer), 3, label),
    ...duplicateIssues(items.map((item) => item.question), `${label} question`),
  ];
  items.forEach((item, index) => {
    if (item.number !== index + 1) issues.push(`${label} ${index + 1}: number must be ${index + 1}`);
    const options = Object.values(item.options);
    if (new Set(options.map((option) => option.trim().toLowerCase())).size < 3) issues.push(`${label} ${item.number}: options must differ`);
  });
  return issues;
}

/**
 * @param text
 * @param min
 * @param max
 * @param label
 * @returns issue when the word count is outside the range
 */
export function lengthIssues(text: string, min: number, max: number, label: string): string[] {
  const words = wordsIn(text);
  return words >= min && words <= max ? [] : [`${label}: ${words} words, expected ${min}-${max}`];
}

/**
 * @param prompt
 * @param ctx
 * @returns prompt with the slot theme, as the generation prompts expect free topics
 */
export function themedMessage(prompt: string, ctx: SlotContext): string {
  const avoid = ctx.existing.length > 0 ? ` Do not reuse these existing ones: ${ctx.existing.join(' | ')}.` : '';
  return `${prompt}\n\nTheme for this exercise: ${ctx.topic}. Use it for at least half of the items or the whole talk.${avoid} Return the JSON only.`;
}
