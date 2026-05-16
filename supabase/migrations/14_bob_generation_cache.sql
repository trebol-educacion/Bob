CREATE TABLE bob_generation_cache (
  cache_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('plan','tts','image','scene')),
  prompt_key text NOT NULL,
  inputs jsonb NOT NULL,
  output_text text,
  output_json jsonb,
  output_blob_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz
);

ALTER TABLE bob_generation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_cache" ON bob_generation_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_cache" ON bob_generation_cache
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_cache" ON bob_generation_cache
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_cache" ON bob_generation_cache
  FOR ALL TO service_role USING (true);
