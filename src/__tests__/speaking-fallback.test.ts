import { describe, it, expect } from 'vitest';
import { openTaskQuestionsToPrompts } from '@/actions/assessment/speaking-fallback';

describe('openTaskQuestionsToPrompts', () => {
  it('convierte los turns de un open_task en AssessmentPrompt[]', () => {
    const questions = { turns: [{ turn_number: 1, prompt_text: 'Hi!' }, { turn_number: 2, prompt_text: 'How are you?' }] };
    expect(openTaskQuestionsToPrompts(questions)).toEqual([
      { turn_number: 1, prompt_text: 'Hi!' },
      { turn_number: 2, prompt_text: 'How are you?' },
    ]);
  });

  it('sin turns o con forma invalida devuelve un array vacio (degrada sin lanzar)', () => {
    expect(openTaskQuestionsToPrompts({})).toEqual([]);
    expect(openTaskQuestionsToPrompts({ turns: 'not-an-array' })).toEqual([]);
    expect(openTaskQuestionsToPrompts({ turns: [{ turn_number: 'x', prompt_text: 1 }] })).toEqual([]);
  });
});
