-- =============================================================================
-- 76_activity_results_preserve_on_session_delete.sql
--
-- Preserve activity grades (the student's tracking history) when a session or
-- chat history is deleted. session_id changes from NOT NULL / ON DELETE CASCADE
-- to NULLABLE / ON DELETE SET NULL, so resetting chat history or deleting a
-- bob_sessions row keeps the bob_activity_results row intact.
--
-- user_id stays ON DELETE CASCADE on purpose: only full student deletion
-- (GDPR erasure via the admin panel) removes the tracking. message_id is
-- already ON DELETE SET NULL.
-- =============================================================================

ALTER TABLE public.bob_activity_results
  ALTER COLUMN session_id DROP NOT NULL;

ALTER TABLE public.bob_activity_results
  DROP CONSTRAINT IF EXISTS bob_activity_results_session_id_fkey;

ALTER TABLE public.bob_activity_results
  ADD CONSTRAINT bob_activity_results_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.bob_sessions(id) ON DELETE SET NULL;
