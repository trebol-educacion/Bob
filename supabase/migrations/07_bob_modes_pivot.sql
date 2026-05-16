-- 20260513_bob_modes_pivot.sql
-- Idempotent migration. Apply once to dev (ftdhbnvbjxyaqoruprcn), then to pro.
-- Change: bob-sections-per-student — Zoe-style attribute model

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Extend CHECK on pedagogical_frameworks to include 'english'
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pedagogical_frameworks
  DROP CONSTRAINT IF EXISTS pedagogical_frameworks_type_check;

ALTER TABLE public.pedagogical_frameworks
  ADD CONSTRAINT pedagogical_frameworks_type_check
  CHECK (type = ANY (ARRAY['lomloe','ib','vess','custom','english']::text[]));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Seed Cambridge English and TOEFL iBT frameworks
--    Uses fixed UUIDs so ON CONFLICT (id) DO NOTHING is safe and idempotent.
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.pedagogical_frameworks (id, name, type, description, structure)
VALUES
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'Cambridge English',
    'english',
    'Cambridge English Language Assessment — A2 Key, B1 Preliminary, B2 First',
    '{"levels": ["a2", "b1", "b2"]}'::jsonb
  ),
  (
    'a1b2c3d4-0002-0002-0002-000000000002',
    'TOEFL iBT',
    'english',
    'Test of English as a Foreign Language — integrated skills',
    '{"levels": ["b1", "b2", "c1"]}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Add cefr_levels column to profiles
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cefr_levels text[] NOT NULL DEFAULT '{}'::text[];

-- Validate each element is a valid CEFR level
-- Drop existing constraint first so re-runs are safe
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cefr_levels_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cefr_levels_check
  CHECK (cefr_levels <@ ARRAY['a1','a2','b1','b2','c1','c2']::text[]);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Create student_english_frameworks table
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_english_frameworks (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id  uuid NOT NULL REFERENCES public.pedagogical_frameworks(id) ON DELETE CASCADE,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_english_frameworks_pkey PRIMARY KEY (user_id, framework_id)
);

CREATE INDEX IF NOT EXISTS idx_sef_user_id
  ON public.student_english_frameworks (user_id);

CREATE INDEX IF NOT EXISTS idx_sef_framework_id
  ON public.student_english_frameworks (framework_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Enable Row Level Security
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_english_frameworks ENABLE ROW LEVEL SECURITY;

-- SELECT: student reads their own rows (works with anon-key in Bob)
DROP POLICY IF EXISTS "student_read_own_frameworks" ON public.student_english_frameworks;
CREATE POLICY "student_read_own_frameworks"
  ON public.student_english_frameworks
  FOR SELECT
  USING (auth.uid() = user_id);

-- service_role bypasses RLS by default in Supabase; no extra policy needed for writes.

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Grants
-- ────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.student_english_frameworks TO anon;
GRANT SELECT ON public.student_english_frameworks TO authenticated;
GRANT ALL    ON public.student_english_frameworks TO service_role;
