BEGIN;

CREATE TABLE IF NOT EXISTS bob_activity_targets (
  skill        text        NOT NULL CHECK (skill IN ('reading','listening','writing','speaking')),
  cefr_level   text        NOT NULL CHECK (cefr_level IN ('pre_a1','a1','a2','b1','b2','c1','c2')),
  target_count int         NOT NULL CHECK (target_count > 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill, cefr_level)
);

ALTER TABLE bob_activity_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_activity_targets_authenticated"
  ON bob_activity_targets
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "super_admin_write_activity_targets"
  ON bob_activity_targets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

INSERT INTO bob_activity_targets (skill, cefr_level, target_count)
SELECT s.skill, l.cefr_level, 10
FROM (VALUES ('reading'),('listening'),('writing'),('speaking')) AS s(skill)
CROSS JOIN (VALUES ('pre_a1'),('a1'),('a2'),('b1'),('b2'),('c1'),('c2')) AS l(cefr_level)
ON CONFLICT (skill, cefr_level) DO NOTHING;

COMMIT;
