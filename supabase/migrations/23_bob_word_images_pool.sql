-- bob_word_images: per-word image pool. Each successful generation appends a
-- row; future sessions can pick a previously generated image at random instead
-- of regenerating, trading off cost/latency for variety. Server picks per
-- request between "reuse from pool" (fast, free) and "generate fresh" (slow,
-- costs LLM tokens, adds variety to the pool). Default split is 70/30 in code.

CREATE TABLE IF NOT EXISTS public.bob_word_images (
  id            BIGSERIAL PRIMARY KEY,
  framework     TEXT NOT NULL,
  cefr_level    TEXT NOT NULL,
  word          TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  scene_prompt  TEXT,
  hit_count     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bob_word_images_pick
  ON public.bob_word_images (framework, cefr_level, word);

ALTER TABLE public.bob_word_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bob_word_images_read_all" ON public.bob_word_images;
CREATE POLICY "bob_word_images_read_all"
  ON public.bob_word_images FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "bob_word_images_insert_authenticated" ON public.bob_word_images;
CREATE POLICY "bob_word_images_insert_authenticated"
  ON public.bob_word_images FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bob_word_images_update_authenticated" ON public.bob_word_images;
CREATE POLICY "bob_word_images_update_authenticated"
  ON public.bob_word_images FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
