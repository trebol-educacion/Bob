BEGIN;

-- T1.1: bob_skill_levels — source of truth for per-skill CEFR level

CREATE TABLE IF NOT EXISTS bob_skill_levels (
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill               text        NOT NULL CHECK (skill IN ('reading','listening','writing','speaking')),
  cefr_level          text        NOT NULL CHECK (cefr_level IN ('pre_a1','a1','a2','b1','b2','c1','c2')),
  origin              text        NOT NULL CHECK (origin IN ('legacy','assessment','manual_teacher','manual_admin')),
  confidence          numeric     NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  last_assessment_at  timestamptz NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_bob_skill_levels_user
  ON bob_skill_levels (user_id);

-- T1.1: bob_skill_level_history — append-only audit trail

CREATE TABLE IF NOT EXISTS bob_skill_level_history (
  id              bigserial   PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill           text        NOT NULL CHECK (skill IN ('reading','listening','writing','speaking')),
  previous_level  text        NULL,
  new_level       text        NOT NULL,
  origin          text        NOT NULL CHECK (origin IN ('legacy','assessment','manual_teacher','manual_admin')),
  triggered_by    uuid        NULL REFERENCES auth.users(id),
  assessment_id   uuid        NULL,
  confidence      numeric     NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bob_skill_level_history_user_skill
  ON bob_skill_level_history (user_id, skill, occurred_at DESC);

-- T1.1: cooldown column on organizations

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS assessment_cooldown_days int NOT NULL DEFAULT 7;

-- T1.1: trigger — any INSERT or UPDATE on bob_skill_levels writes history atomically
-- The server action sets bob.assessment_id via set_config before the UPSERT;
-- manual/backfill changes leave assessment_id NULL.

CREATE OR REPLACE FUNCTION bob_skill_levels_history_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev          text;
  v_assessment_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_prev := NULL;
  ELSE
    IF NEW.cefr_level IS NOT DISTINCT FROM OLD.cefr_level
       AND NEW.origin IS NOT DISTINCT FROM OLD.origin THEN
      RETURN NEW;
    END IF;
    v_prev := OLD.cefr_level;
  END IF;

  BEGIN
    v_assessment_id := current_setting('bob.assessment_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_assessment_id := NULL;
  END;

  INSERT INTO bob_skill_level_history (
    user_id, skill, previous_level, new_level,
    origin, triggered_by, assessment_id, confidence
  ) VALUES (
    NEW.user_id, NEW.skill, v_prev, NEW.cefr_level,
    NEW.origin, auth.uid(), v_assessment_id, NEW.confidence
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER bob_skill_levels_history_trigger
AFTER INSERT OR UPDATE ON bob_skill_levels
FOR EACH ROW EXECUTE FUNCTION bob_skill_levels_history_fn();

-- T1.1: RLS

ALTER TABLE bob_skill_levels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bob_skill_level_history  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_rw_own_skill_levels"
  ON bob_skill_levels
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "teacher_read_skill_levels"
  ON bob_skill_levels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles teacher
      JOIN profiles student ON student.organization_id = teacher.organization_id
      WHERE teacher.id = auth.uid()
        AND teacher.role IN ('teacher','school_admin','super_admin')
        AND student.id = bob_skill_levels.user_id
    )
  );

CREATE POLICY "student_read_own_history"
  ON bob_skill_level_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT is always via the trigger (which fires in the session context of the
-- bob_skill_levels UPDATE/INSERT, whose RLS already validated the actor).
CREATE POLICY "history_insert_trigger_only"
  ON bob_skill_level_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "teacher_read_history"
  ON bob_skill_level_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles teacher
      JOIN profiles student ON student.organization_id = teacher.organization_id
      WHERE teacher.id = auth.uid()
        AND teacher.role IN ('teacher','school_admin','super_admin')
        AND student.id = bob_skill_level_history.user_id
    )
  );

-- T1.1: backfill from profiles.cefr_active_level (idempotent — ON CONFLICT DO NOTHING)
-- Propagates each legacy scalar level to all 4 skills with origin='legacy'.
-- The trigger above will write the corresponding history rows automatically.

INSERT INTO bob_skill_levels (user_id, skill, cefr_level, origin, updated_at)
SELECT
  p.id,
  s.skill,
  p.cefr_active_level,
  'legacy',
  now()
FROM profiles p
CROSS JOIN (VALUES ('reading'),('listening'),('writing'),('speaking')) AS s(skill)
WHERE p.cefr_active_level IS NOT NULL
  AND p.cefr_active_level IN ('pre_a1','a1','a2','b1','b2','c1','c2')
ON CONFLICT (user_id, skill) DO NOTHING;

COMMIT;
