-- Extend bob_sessions mode check to include new exam modes
ALTER TABLE bob_sessions DROP CONSTRAINT IF EXISTS bob_sessions_mode_check;

ALTER TABLE bob_sessions ADD CONSTRAINT bob_sessions_mode_check
  CHECK (mode IN (
    'situation',
    'image',
    'conversation',
    'b1_collaborative',
    'a2_part1',
    'toefl_listen_repeat',
    'toefl_interview',
    'b2_speaking'
  ));
