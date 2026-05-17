-- Adds a per-prompt lifecycle status so we can publish actively a subset of
-- activities and surface the rest as 'coming soon' (visible but locked) or
-- fully hidden (not in the catalogue at all). Default 'enabled' preserves
-- current behaviour for every existing row.

ALTER TABLE public.bob_prompts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'enabled';

ALTER TABLE public.bob_prompts
  DROP CONSTRAINT IF EXISTS bob_prompts_status_check;

ALTER TABLE public.bob_prompts
  ADD CONSTRAINT bob_prompts_status_check
  CHECK (status IN ('enabled', 'coming_soon', 'hidden'));

CREATE INDEX IF NOT EXISTS idx_bob_prompts_status ON public.bob_prompts (status);
