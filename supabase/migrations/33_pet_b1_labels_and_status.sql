-- Migration 33: PET (B1) catalog adjustments
-- 1. Rename PET Speaking Part 3 and Part 4 to official Cambridge nomenclature.
-- 2. Mark Writing Part 2 and Listening Part 1 as coming_soon.
-- 3. Mark Speaking Part 3 as enabled.

UPDATE public.bob_prompts
SET label = 'Speaking Part 3: Collaborative Task',
    status = 'enabled'
WHERE prompt_key = 'cambridge_pet_p3_b1_generation';

UPDATE public.bob_prompts
SET label = 'Speaking Part 4: Discussion'
WHERE prompt_key = 'cambridge_pet_p4_b1_generation';

UPDATE public.bob_prompts
SET status = 'coming_soon'
WHERE prompt_key IN (
  'cambridge_pet_writing_part2_b1_generation',
  'cambridge_pet_listening_part1_b1_generation'
);
