BEGIN;

ALTER TABLE bob_prompts
  ADD COLUMN IF NOT EXISTS skill text NULL;

UPDATE bob_prompts
SET skill = CASE
  WHEN exam_part ILIKE '%reading%'    THEN 'reading'
  WHEN exam_part ILIKE '%writing%'    THEN 'writing'
  WHEN exam_part ILIKE '%listening%'  THEN 'listening'
  WHEN exam_part ILIKE 'assessment%'  THEN 'assessment'
  ELSE 'speaking'
END
WHERE skill IS NULL;

ALTER TABLE bob_prompts
  ALTER COLUMN skill SET NOT NULL;

ALTER TABLE bob_prompts
  ADD CONSTRAINT bob_prompts_skill_check
    CHECK (skill IN ('listening','speaking','reading','writing','assessment'));

CREATE INDEX IF NOT EXISTS bob_prompts_skill_idx ON bob_prompts (skill);

COMMIT;
