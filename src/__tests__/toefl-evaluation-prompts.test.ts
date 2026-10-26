import { describe, expect, it } from 'vitest';
import { FALLBACK_PROMPTS } from '@/lib/prompts/db-prompts';
import { TOEFL_FALLBACK_PROMPTS } from '@/lib/prompts/fallback-prompts-toefl';

describe('TOEFL Speaking evaluation prompts', () => {
  it('exposes both keys through the prompt fallback map', () => {
    expect(FALLBACK_PROMPTS.toefl_interview_b2_formative).toBe(TOEFL_FALLBACK_PROMPTS.toefl_interview_b2_formative);
    expect(FALLBACK_PROMPTS.toefl_listen_repeat_b1_objective).toBe(TOEFL_FALLBACK_PROMPTS.toefl_listen_repeat_b1_objective);
  });

  it('keeps the placeholders the actions fill in', () => {
    expect(TOEFL_FALLBACK_PROMPTS.toefl_interview_b2_formative).toContain('{QUESTION}');
    expect(TOEFL_FALLBACK_PROMPTS.toefl_listen_repeat_b1_objective.match(/\{TARGET_SENTENCE\}/g)).toHaveLength(2);
  });
});
