BEGIN;

-- Install pg_net for async HTTP calls from triggers.
-- Extension is available on Supabase Pro; lives in the 'net' schema.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Config table: worker URL + auth token (service_role JWT).
-- MANUAL STEP REQUIRED after deploy:
--   INSERT INTO bob_app_config (key, value)
--   VALUES ('worker_auth', '<paste service_role_jwt here>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
CREATE TABLE IF NOT EXISTS bob_app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO bob_app_config (key, value)
VALUES
  ('worker_url',  'https://ftdhbnvbjxyaqoruprcn.supabase.co/functions/v1/assessment-eval-worker'),
  ('worker_auth', 'PASTE_SERVICE_ROLE_JWT_HERE')
ON CONFLICT (key) DO NOTHING;

-- Queue table: one row per submitted assessment that needs LLM evaluation.
-- Normal users can only SELECT their own rows.
-- Only service_role (Edge Function) can INSERT / UPDATE / DELETE.
CREATE TABLE IF NOT EXISTS bob_assessment_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id uuid        NOT NULL,
  skill         text        NOT NULL CHECK (skill IN ('speaking','listening','reading','writing')),
  session_id    uuid        NOT NULL REFERENCES bob_sessions(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','done','failed')),
  payload       jsonb       NOT NULL,
  result        jsonb       NULL,
  error         text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz NULL,
  completed_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_bob_assessment_queue_user_status
  ON bob_assessment_queue (user_id, status, created_at DESC);

ALTER TABLE bob_assessment_queue ENABLE ROW LEVEL SECURITY;

-- Students may read their own queue rows (to poll status if needed).
CREATE POLICY "student_read_own_queue"
  ON bob_assessment_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Dispatch function: fires net.http_post to the Edge Function on INSERT.
-- Reads URL + auth from bob_app_config at call time so they can be rotated
-- without redeploying. If worker_auth is still the placeholder, the call
-- is skipped silently (the queue row is still persisted).
CREATE OR REPLACE FUNCTION notify_assessment_eval_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_url  text;
  v_auth text;
BEGIN
  SELECT value INTO v_url  FROM bob_app_config WHERE key = 'worker_url';
  SELECT value INTO v_auth FROM bob_app_config WHERE key = 'worker_auth';

  IF v_url IS NULL OR v_url = ''
     OR v_auth IS NULL OR v_auth = 'PASTE_SERVICE_ROLE_JWT_HERE' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     => v_url,
    body    => jsonb_build_object('queue_id', NEW.id),
    headers => jsonb_build_object('Authorization', 'Bearer ' || v_auth)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER bob_assessment_queue_dispatch_trigger
AFTER INSERT ON bob_assessment_queue
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION notify_assessment_eval_worker();

COMMIT;
