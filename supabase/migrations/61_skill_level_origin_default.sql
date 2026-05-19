-- Allow students to self-set a default skill level (origin='default')
-- Used when the student chooses "Start with A1" instead of taking an Assessment.

ALTER TABLE bob_skill_levels DROP CONSTRAINT bob_skill_levels_origin_check;
ALTER TABLE bob_skill_levels ADD CONSTRAINT bob_skill_levels_origin_check
  CHECK (origin IN ('legacy','assessment','manual_teacher','manual_admin','default'));

ALTER TABLE bob_skill_level_history DROP CONSTRAINT bob_skill_level_history_origin_check;
ALTER TABLE bob_skill_level_history ADD CONSTRAINT bob_skill_level_history_origin_check
  CHECK (origin IN ('legacy','assessment','manual_teacher','manual_admin','default'));
