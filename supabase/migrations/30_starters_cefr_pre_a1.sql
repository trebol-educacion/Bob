-- Splits Cambridge Starters out of A1 by introducing the proper Pre-A1 level.
-- Until now Starters rows lived under cefr_level='a1' which mixed Pre-A1
-- (Starters, ages 6-8) with A1 (Movers, ages 8-11) in the same selector.

ALTER TABLE public.bob_prompts
  DROP CONSTRAINT IF EXISTS bob_prompts_cefr_level_check;

ALTER TABLE public.bob_prompts
  ADD CONSTRAINT bob_prompts_cefr_level_check
  CHECK (cefr_level IS NULL OR cefr_level = ANY (ARRAY['pre_a1','a1','a2','b1','b2','b1/b2','c1','c2']::text[]));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cefr_active_level_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cefr_active_level_check
  CHECK (cefr_active_level IS NULL OR cefr_active_level = ANY (ARRAY['pre_a1','a1','a2','b1','b2','c1','c2']::text[]));

UPDATE public.bob_prompts
   SET cefr_level = 'pre_a1'
 WHERE framework = 'cambridge'
   AND exam_part LIKE 'starters_%';
