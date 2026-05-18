-- Migration 52 — allow `phrase_plan` msg_type on bob_messages
--
-- The Phrase Practice activity persists the full 10-phrase plan as one
-- `phrase_plan` message at session start so the session can be resumed
-- mid-flow. Without this msg_type the CHECK constraint rejects the row.

ALTER TABLE public.bob_messages DROP CONSTRAINT bob_messages_msg_type_check;
ALTER TABLE public.bob_messages ADD CONSTRAINT bob_messages_msg_type_check
  CHECK (msg_type = ANY (ARRAY[
    'text'::text,
    'phrase'::text,
    'phrase_plan'::text,
    'image_scene'::text,
    'evaluation'::text,
    'user_audio'::text,
    'yl_cue'::text,
    'yl_tts'::text
  ]));
