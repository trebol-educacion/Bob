import type { AssessmentPrompt } from './types';

export const FALLBACK_SPEAKING_PROMPTS: Record<string, AssessmentPrompt[]> = {
  cefr_assessment_speaking_a1_a2_generation: [
    { turn_number: 1, prompt_text: 'Tell me about your school — what do you study and which subject do you like best?' },
    { turn_number: 2, prompt_text: 'Describe what you usually do on weekends.' },
    { turn_number: 3, prompt_text: 'Imagine you are in a park with friends. Tell me what is happening.' },
  ],
  cefr_assessment_speaking_b1_b2_generation: [
    { turn_number: 1, prompt_text: 'Tell me about a memorable trip or outing you have taken. Where did you go and what made it special?' },
    { turn_number: 2, prompt_text: 'Describe how technology has changed the way young people study or communicate.' },
    { turn_number: 3, prompt_text: 'A friend is nervous about an important exam and asks for your advice. What would you say to them and why?' },
  ],
  cefr_assessment_speaking_yl_pre_a1_generation: [
    { turn_number: 1, prompt_text: 'Hi! What is your name?' },
    { turn_number: 2, prompt_text: 'How old are you? And what is your favourite colour? 🎨' },
    { turn_number: 3, prompt_text: 'Tell me about your family. How many people are in your family? 👨‍👩‍👧' },
  ],
  cefr_assessment_speaking_yl_a1_generation: [
    { turn_number: 1, prompt_text: 'What do you like to do after school? ⭐' },
    { turn_number: 2, prompt_text: 'Tell me about your favourite animal. What does it look like? 🐾' },
    { turn_number: 3, prompt_text: 'What is the weather like today? Do you like this kind of weather? ☀️' },
  ],
};

/**
 * @param questions Record<string, unknown>
 * @returns AssessmentPrompt[]
 */
export function openTaskQuestionsToPrompts(questions: Record<string, unknown>): AssessmentPrompt[] {
  const turns = questions.turns;
  if (!Array.isArray(turns)) return [];

  const prompts: AssessmentPrompt[] = [];
  for (const turn of turns) {
    if (
      turn && typeof turn === 'object' &&
      typeof (turn as { turn_number?: unknown }).turn_number === 'number' &&
      typeof (turn as { prompt_text?: unknown }).prompt_text === 'string'
    ) {
      prompts.push({
        turn_number: (turn as { turn_number: number }).turn_number,
        prompt_text: (turn as { prompt_text: string }).prompt_text,
      });
    }
  }
  return prompts;
}
