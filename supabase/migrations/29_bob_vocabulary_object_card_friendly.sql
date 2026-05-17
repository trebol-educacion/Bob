-- Marks which vocabulary words work well as standalone "object card" images
-- for activities like Starters Part 3 "What's This?". Excludes concepts that
-- cannot be illustrated as a single centered flashcard:
-- - landscapes / weather concepts (sea, sun, beach, sand)
-- - generic people (boy, girl, baby, teacher, man, woman, alien, monster)
-- - isolated body parts (ambiguous and used in dedicated body-parts activities)

ALTER TABLE public.bob_vocabulary
  ADD COLUMN IF NOT EXISTS object_card_friendly BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.bob_vocabulary
  SET object_card_friendly = FALSE
  WHERE category = 'body'
     OR category = 'people'
     OR (category = 'nature' AND word IN ('beach', 'sand', 'sea', 'sun'));

CREATE INDEX IF NOT EXISTS idx_bob_vocabulary_object_card
  ON public.bob_vocabulary (framework, cefr_level, object_card_friendly)
  WHERE object_card_friendly = TRUE;
