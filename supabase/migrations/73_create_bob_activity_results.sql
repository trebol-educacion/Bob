-- =============================================================================
-- bob_activity_results
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bob_activity_results (
  id           uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid         NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  session_id   uuid         NOT NULL REFERENCES public.bob_sessions(id) ON DELETE CASCADE,
  message_id   uuid         NULL     REFERENCES public.bob_messages(id) ON DELETE SET NULL,
  mode         text         NOT NULL,
  framework    text         NULL,
  exam_part    text         NULL,
  cefr_level   text         NULL,
  skill        text         NOT NULL,
  measure_type text         NOT NULL,
  raw_score    numeric      NULL,
  max_score    numeric      NULL,
  score_10     numeric(4,1) NULL,
  rubric_json  jsonb        NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT bob_activity_results_skill_check
    CHECK (skill = ANY (ARRAY['reading','listening','writing','speaking'])),
  CONSTRAINT bob_activity_results_measure_type_check
    CHECK (measure_type = ANY (ARRAY['score','rubric'])),
  CONSTRAINT bob_activity_results_score_10_range
    CHECK (score_10 IS NULL OR (score_10 >= 0 AND score_10 <= 10))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bob_activity_results_user_skill
  ON public.bob_activity_results (user_id, skill, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bob_activity_results_user_created
  ON public.bob_activity_results (user_id, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.bob_activity_results ENABLE ROW LEVEL SECURITY;

-- Alumno: RW sobre sus propias filas (idéntico a student_rw_own_skill_levels)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'bob_activity_results'
      AND policyname = 'student_rw_own_activity_results') THEN
    CREATE POLICY student_rw_own_activity_results ON public.bob_activity_results
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Docente/admin: lectura por organización (clon exacto de teacher_read_skill_levels)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'bob_activity_results'
      AND policyname = 'teacher_read_activity_results') THEN
    CREATE POLICY teacher_read_activity_results ON public.bob_activity_results
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM (profiles teacher
            JOIN profiles student ON student.organization_id = teacher.organization_id)
          WHERE teacher.id = auth.uid()
            AND teacher.role = ANY (ARRAY['teacher'::user_role, 'school_admin'::user_role, 'super_admin'::user_role])
            AND student.id = bob_activity_results.user_id
        )
      );
  END IF;
END $$;
