-- Migration 36: CAE (C1) catalog — keep only Collaborative Task enabled.

UPDATE public.bob_prompts
SET status = 'coming_soon'
WHERE prompt_key IN (
  'cambridge_cae_p1_c1_generation',
  'cambridge_cae_p2_c1_generation'
);
