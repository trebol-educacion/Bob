-- Migration 37: CPE (C2) catalog — keep only Extended Discussion (Part 3B) enabled.

UPDATE public.bob_prompts
SET status = 'coming_soon'
WHERE prompt_key IN (
  'cambridge_cpe_p1_c2_generation',
  'cambridge_cpe_p3a_c2_generation'
);
