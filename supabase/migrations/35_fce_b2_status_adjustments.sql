-- Migration 35: FCE (B2) catalog status adjustments.
-- 1. Mark Writing Part 2 (Choice Task) and Listening Part 1 (Short Extracts) as coming_soon.
-- 2. Mark Listening Part 4 (Long Interview) as enabled.

UPDATE public.bob_prompts
SET status = 'coming_soon'
WHERE prompt_key IN (
  'cambridge_fce_writing_part2_b2_generation',
  'cambridge_fce_listening_part1_b2_generation'
);

UPDATE public.bob_prompts
SET status = 'enabled'
WHERE prompt_key = 'cambridge_fce_listening_part4_b2_generation';
