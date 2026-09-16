-- Migration 90: surface B1 PET Speaking Part 3 (Collaborative Task) in the catalog.
-- The activity is already built (B1CollaborativePractice, routed as cambridge_pet_p3)
-- and D-D2-compliant: its real evaluation (part3.ts evaluatePart3Action) returns
-- formative feedback with no numeric score. Only its generation row was left hidden,
-- which kept the card out of the catalog (the catalog derives from generation rows
-- where status != 'hidden'). Enable it so all four B1 speaking parts are selectable.
UPDATE public.bob_prompts
SET status = 'enabled', updated_at = now()
WHERE framework = 'cambridge'
  AND cefr_level = 'b1'
  AND exam_part = 'pet_p3'
  AND activity_type = 'generation';
