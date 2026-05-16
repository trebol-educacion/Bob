-- bob_prompts_official Part A: snapshot + profiles + bob_prompts schema + wipe

CREATE TABLE IF NOT EXISTS bob_prompts_snapshot_v1 AS SELECT * FROM bob_prompts;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cefr_active_level text NULL CHECK (cefr_active_level IS NULL OR cefr_active_level IN ('a1','a2','b1','b2','c1','c2'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cefr_level_locked boolean NOT NULL DEFAULT false;

UPDATE profiles SET cefr_active_level = (
  SELECT level FROM unnest(cefr_levels) AS level
  ORDER BY CASE level
    WHEN 'c2' THEN 6 WHEN 'c1' THEN 5 WHEN 'b2' THEN 4
    WHEN 'b1' THEN 3 WHEN 'a2' THEN 2 WHEN 'a1' THEN 1
    ELSE 0
  END DESC
  LIMIT 1
)
WHERE cefr_levels IS NOT NULL AND array_length(cefr_levels, 1) > 0 AND cefr_active_level IS NULL;

ALTER TABLE profiles DROP COLUMN IF EXISTS cefr_levels;

ALTER TABLE bob_prompts RENAME COLUMN mode TO legacy_mode;
ALTER TABLE bob_prompts ADD COLUMN IF NOT EXISTS framework text NULL;
ALTER TABLE bob_prompts ADD COLUMN IF NOT EXISTS exam_part text NULL;
ALTER TABLE bob_prompts ALTER COLUMN legacy_mode DROP NOT NULL;

ALTER TABLE bob_prompts DROP CONSTRAINT IF EXISTS bob_prompts_mode_check;
ALTER TABLE bob_prompts DROP CONSTRAINT IF EXISTS bob_prompts_activity_type_check;
DROP INDEX IF EXISTS idx_bob_prompts_mode_type;

DELETE FROM bob_prompts;
