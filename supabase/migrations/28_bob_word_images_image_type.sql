-- Separates the image pool by intended use so different activities can
-- request the right kind of asset without contaminating each other.
-- - 'scene': rich scenes (used by Pointing Part 1; image_gen requires people)
-- - 'object_card': single object on neutral background (Starters Part 3 "What's This?")

ALTER TABLE public.bob_word_images
  ADD COLUMN IF NOT EXISTS image_type TEXT NOT NULL DEFAULT 'scene'
    CHECK (image_type IN ('scene', 'object_card'));

CREATE INDEX IF NOT EXISTS idx_bob_word_images_lookup
  ON public.bob_word_images (framework, cefr_level, word, image_type);
