ALTER TABLE bob_prompts ALTER COLUMN framework SET NOT NULL;
ALTER TABLE bob_prompts ALTER COLUMN exam_part SET NOT NULL;
ALTER TABLE bob_prompts ADD CONSTRAINT bob_prompts_check_framework CHECK (framework IN ('cambridge','toefl','generic'));
ALTER TABLE bob_prompts ADD CONSTRAINT bob_prompts_check_activity_type CHECK (activity_type IN ('generation','evaluation','framing','partner_turn','partner_turn_audio','model_answer','examiner_reaction','image_gen','transcribe'));
ALTER TABLE bob_prompts ADD CONSTRAINT bob_prompts_unique_quad UNIQUE (framework, exam_part, cefr_level, activity_type);
CREATE INDEX IF NOT EXISTS bob_prompts_framework_cefr_idx ON bob_prompts (framework, cefr_level);
CREATE INDEX IF NOT EXISTS bob_prompts_framework_part_idx ON bob_prompts (framework, exam_part);
