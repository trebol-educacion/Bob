/*
  Bob module — DDL promotion script for production Supabase projects.

  Pre-condition: MIA schema already exists (organizations, profiles,
  auth.users, pedagogical_frameworks, user_role enum).

  Apply order:
    1. Extension         — pg_net (HTTP calls from triggers)
    2. ALTER tables      — Bob columns on organizations + profiles
    3. CREATE TABLES     — core tables (FK-dependency order)
    4. Indexes           — after table creation
    5. Functions         — trigger functions
    6. Triggers          — wired to their functions
    7. RLS               — enable + policies for all Bob tables
    8. Rollout guard     — is_bob_enabled = false on all orgs

  Idempotent: safe to run twice.
*/

-- =============================================================================
-- 1. EXTENSION
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- =============================================================================
-- 2. ALTER organizations — Bob columns
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_bob_enabled        boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_voice_storage   boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_data_retention  boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assessment_cooldown_days integer     NOT NULL DEFAULT 7;


-- =============================================================================
-- 3. ALTER profiles — Bob columns
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cefr_active_level  text    NULL,
  ADD COLUMN IF NOT EXISTS cefr_level_locked  boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_cefr_active_level_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cefr_active_level_check
      CHECK (
        cefr_active_level IS NULL OR
        cefr_active_level = ANY (ARRAY['pre_a1','a1','a2','b1','b2','c1','c2']::text[])
      );
  END IF;
END $$;


-- =============================================================================
-- 4. CREATE TABLES
-- =============================================================================

-- --------------------------------------------------------------------------
-- bob_sessions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_sessions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode        text        NOT NULL,
  topic       text        NULL,
  title       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  plan_json   jsonb       NULL
);

-- --------------------------------------------------------------------------
-- bob_messages
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_messages (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   uuid        NOT NULL REFERENCES public.bob_sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL,
  msg_type     text        NOT NULL,
  content_text text        NULL,
  content_json jsonb       NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bob_messages_role_check
    CHECK (role = ANY (ARRAY['bob','user'])),
  CONSTRAINT bob_messages_msg_type_check
    CHECK (msg_type = ANY (ARRAY[
      'text','phrase','phrase_plan','image_scene',
      'evaluation','user_audio','yl_cue','yl_tts'
    ]))
);

-- --------------------------------------------------------------------------
-- bob_prompts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_prompts (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_key      text        NOT NULL,
  legacy_mode     text        NULL,
  activity_type   text        NOT NULL,
  cefr_level      text        NULL,
  label           text        NOT NULL,
  description     text        NULL,
  prompt_default  text        NOT NULL,
  prompt_current  text        NOT NULL,
  variables       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        NULL REFERENCES auth.users(id),
  framework       text        NOT NULL,
  exam_part       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'enabled',
  skill           text        NOT NULL,

  CONSTRAINT bob_prompts_key_unique       UNIQUE (prompt_key),
  CONSTRAINT bob_prompts_unique_quad      UNIQUE (framework, exam_part, cefr_level, activity_type),

  CONSTRAINT bob_prompts_check_framework
    CHECK (framework = ANY (ARRAY['cambridge','toefl','generic','cefr','cambridge_yl'])),
  CONSTRAINT bob_prompts_check_activity_type
    CHECK (activity_type = ANY (ARRAY[
      'generation','evaluation','framing','partner_turn','partner_turn_audio',
      'model_answer','examiner_reaction','image_gen','transcribe',
      'assessment_speaking','assessment_speaking_eval',
      'assessment_writing','assessment_writing_eval'
    ])),
  CONSTRAINT bob_prompts_cefr_level_check
    CHECK (cefr_level IS NULL OR cefr_level = ANY (
      ARRAY['pre_a1','a1','a2','b1','b2','b1/b2','c1','c2']
    )),
  CONSTRAINT bob_prompts_status_check
    CHECK (status = ANY (ARRAY['enabled','coming_soon','hidden'])),
  CONSTRAINT bob_prompts_skill_check
    CHECK (skill = ANY (ARRAY['listening','speaking','reading','writing','assessment']))
);

-- --------------------------------------------------------------------------
-- bob_prompts_snapshot_v1  (historical snapshot — no PK, no FKs by design)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_prompts_snapshot_v1 (
  id              uuid        NULL,
  prompt_key      text        NULL,
  mode            text        NULL,
  activity_type   text        NULL,
  cefr_level      text        NULL,
  label           text        NULL,
  description     text        NULL,
  prompt_default  text        NULL,
  prompt_current  text        NULL,
  variables       jsonb       NULL,
  updated_at      timestamptz NULL,
  updated_by      uuid        NULL
);

-- --------------------------------------------------------------------------
-- bob_generation_cache
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_generation_cache (
  cache_key       text        NOT NULL PRIMARY KEY,
  kind            text        NOT NULL,
  prompt_key      text        NOT NULL,
  inputs          jsonb       NOT NULL,
  output_text     text        NULL,
  output_json     jsonb       NULL,
  output_blob_url text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  hit_count       integer     NOT NULL DEFAULT 0,
  last_hit_at     timestamptz NULL,

  CONSTRAINT bob_generation_cache_kind_check
    CHECK (kind = ANY (ARRAY['plan','tts','image','scene']))
);

-- --------------------------------------------------------------------------
-- bob_closed_items
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_closed_items (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework           text        NOT NULL,
  exam_part           text        NOT NULL,
  cefr_level          text        NULL,
  variant_id          text        NOT NULL,
  stimulus_audio_url  text        NULL,
  stimulus_text       text        NULL,
  stimulus_image_url  text        NULL,
  question            text        NOT NULL,
  options             jsonb       NOT NULL,
  correct_key         text        NOT NULL,
  explanation         text        NULL,
  source              text        NOT NULL DEFAULT 'curated',
  created_at          timestamptz NOT NULL DEFAULT now(),
  skill               text        NULL,
  status              text        NOT NULL DEFAULT 'enabled',
  transcript          text        NULL,
  metadata            jsonb       NULL,

  CONSTRAINT bob_closed_items_framework_exam_part_cefr_level_variant_id_key
    UNIQUE (framework, exam_part, cefr_level, variant_id),

  CONSTRAINT bob_closed_items_source_check
    CHECK (source = ANY (ARRAY['curated','official','generated_then_curated'])),
  CONSTRAINT bob_closed_items_status_check
    CHECK (status = ANY (ARRAY['enabled','disabled','draft']))
);

-- --------------------------------------------------------------------------
-- bob_vocabulary
-- --------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.bob_vocabulary_id_seq;

CREATE TABLE IF NOT EXISTS public.bob_vocabulary (
  id                  bigint      NOT NULL DEFAULT nextval('public.bob_vocabulary_id_seq') PRIMARY KEY,
  framework           text        NOT NULL,
  cefr_level          text        NOT NULL,
  exam_part           text        NULL,
  category            text        NOT NULL,
  word                text        NOT NULL,
  word_type           text        NOT NULL DEFAULT 'noun',
  pointable           boolean     NOT NULL DEFAULT true,
  notes               text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  object_card_friendly boolean    NOT NULL DEFAULT true,

  CONSTRAINT bob_vocabulary_unique UNIQUE (framework, cefr_level, word)
);

ALTER SEQUENCE public.bob_vocabulary_id_seq OWNED BY public.bob_vocabulary.id;

-- --------------------------------------------------------------------------
-- bob_word_images
-- --------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.bob_word_images_id_seq;

CREATE TABLE IF NOT EXISTS public.bob_word_images (
  id           bigint      NOT NULL DEFAULT nextval('public.bob_word_images_id_seq') PRIMARY KEY,
  framework    text        NOT NULL,
  cefr_level   text        NOT NULL,
  word         text        NOT NULL,
  image_url    text        NOT NULL,
  scene_prompt text        NULL,
  hit_count    integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL,
  image_type   text        NOT NULL DEFAULT 'scene',

  CONSTRAINT bob_word_images_image_type_check
    CHECK (image_type = ANY (ARRAY['scene','object_card','photo_realistic']))
);

ALTER SEQUENCE public.bob_word_images_id_seq OWNED BY public.bob_word_images.id;

-- --------------------------------------------------------------------------
-- bob_skill_levels
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_skill_levels (
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill              text        NOT NULL,
  cefr_level         text        NOT NULL,
  origin             text        NOT NULL,
  confidence         numeric     NULL,
  last_assessment_at timestamptz NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill),

  CONSTRAINT bob_skill_levels_skill_check
    CHECK (skill = ANY (ARRAY['reading','listening','writing','speaking'])),
  CONSTRAINT bob_skill_levels_cefr_level_check
    CHECK (cefr_level = ANY (ARRAY['pre_a1','a1','a2','b1','b2','c1','c2'])),
  CONSTRAINT bob_skill_levels_origin_check
    CHECK (origin = ANY (ARRAY['legacy','assessment','manual_teacher','manual_admin','default'])),
  CONSTRAINT bob_skill_levels_confidence_check
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

-- --------------------------------------------------------------------------
-- bob_skill_level_history
-- --------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.bob_skill_level_history_id_seq;

CREATE TABLE IF NOT EXISTS public.bob_skill_level_history (
  id             bigint      NOT NULL DEFAULT nextval('public.bob_skill_level_history_id_seq') PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill          text        NOT NULL,
  previous_level text        NULL,
  new_level      text        NOT NULL,
  origin         text        NOT NULL,
  triggered_by   uuid        NULL REFERENCES auth.users(id),
  assessment_id  uuid        NULL,
  confidence     numeric     NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bob_skill_level_history_skill_check
    CHECK (skill = ANY (ARRAY['reading','listening','writing','speaking'])),
  CONSTRAINT bob_skill_level_history_origin_check
    CHECK (origin = ANY (ARRAY['legacy','assessment','manual_teacher','manual_admin','default']))
);

ALTER SEQUENCE public.bob_skill_level_history_id_seq OWNED BY public.bob_skill_level_history.id;

-- --------------------------------------------------------------------------
-- bob_app_config
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_app_config (
  key   text NOT NULL PRIMARY KEY,
  value text NOT NULL
);

-- --------------------------------------------------------------------------
-- bob_assessment_queue
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bob_assessment_queue (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id uuid        NOT NULL,
  skill         text        NOT NULL,
  session_id    uuid        NOT NULL REFERENCES public.bob_sessions(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending',
  payload       jsonb       NOT NULL,
  result        jsonb       NULL,
  error         text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz NULL,
  completed_at  timestamptz NULL,

  CONSTRAINT bob_assessment_queue_skill_check
    CHECK (skill = ANY (ARRAY['speaking','listening','reading','writing'])),
  CONSTRAINT bob_assessment_queue_status_check
    CHECK (status = ANY (ARRAY['pending','processing','done','failed']))
);

-- --------------------------------------------------------------------------
-- audit_log
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action          text        NOT NULL,
  actor_user_id   uuid        NOT NULL,
  target_user_id  uuid        NULL,
  organization_id uuid        NULL,
  details         jsonb       NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- student_english_frameworks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_english_frameworks (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id uuid        NOT NULL REFERENCES public.pedagogical_frameworks(id) ON DELETE CASCADE,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, framework_id)
);


-- =============================================================================
-- 5. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS bob_sessions_user_id_created_at_idx
  ON public.bob_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bob_sessions_user_mode_created_idx
  ON public.bob_sessions (user_id, mode, created_at DESC);

CREATE INDEX IF NOT EXISTS bob_messages_session_id_idx
  ON public.bob_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS bob_prompts_framework_cefr_idx
  ON public.bob_prompts (framework, cefr_level);

CREATE INDEX IF NOT EXISTS bob_prompts_framework_part_idx
  ON public.bob_prompts (framework, exam_part);

CREATE INDEX IF NOT EXISTS bob_prompts_skill_idx
  ON public.bob_prompts (skill);

CREATE INDEX IF NOT EXISTS idx_bob_prompts_status
  ON public.bob_prompts (status);

CREATE INDEX IF NOT EXISTS bob_closed_items_lookup_idx
  ON public.bob_closed_items (framework, exam_part, cefr_level);

CREATE INDEX IF NOT EXISTS bob_closed_items_skill_cefr_idx
  ON public.bob_closed_items (skill, cefr_level, status)
  WHERE skill IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bob_vocab_pick
  ON public.bob_vocabulary (framework, cefr_level, category, pointable);

CREATE INDEX IF NOT EXISTS idx_bob_vocabulary_object_card
  ON public.bob_vocabulary (framework, cefr_level, object_card_friendly)
  WHERE object_card_friendly = true;

CREATE INDEX IF NOT EXISTS idx_bob_word_images_lookup
  ON public.bob_word_images (framework, cefr_level, word, image_type);

CREATE INDEX IF NOT EXISTS idx_bob_word_images_pick
  ON public.bob_word_images (framework, cefr_level, word);

CREATE INDEX IF NOT EXISTS idx_bob_skill_levels_user
  ON public.bob_skill_levels (user_id);

CREATE INDEX IF NOT EXISTS idx_bob_skill_level_history_user_skill
  ON public.bob_skill_level_history (user_id, skill, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_bob_assessment_queue_user_status
  ON public.bob_assessment_queue (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_org_idx
  ON public.audit_log (organization_id);

CREATE INDEX IF NOT EXISTS audit_log_target_user_idx
  ON public.audit_log (target_user_id);

CREATE INDEX IF NOT EXISTS idx_sef_user_id
  ON public.student_english_frameworks (user_id);

CREATE INDEX IF NOT EXISTS idx_sef_framework_id
  ON public.student_english_frameworks (framework_id);


-- =============================================================================
-- 6. FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_bob_sessions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bob_skill_levels_history_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev          text;
  v_assessment_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_prev := NULL;
  ELSE
    IF NEW.cefr_level IS NOT DISTINCT FROM OLD.cefr_level
       AND NEW.origin IS NOT DISTINCT FROM OLD.origin THEN
      RETURN NEW;
    END IF;
    v_prev := OLD.cefr_level;
  END IF;

  BEGIN
    v_assessment_id := current_setting('bob.assessment_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_assessment_id := NULL;
  END;

  INSERT INTO public.bob_skill_level_history (
    user_id, skill, previous_level, new_level,
    origin, triggered_by, assessment_id, confidence
  ) VALUES (
    NEW.user_id, NEW.skill, v_prev, NEW.cefr_level,
    NEW.origin, auth.uid(), v_assessment_id, NEW.confidence
  );

  RETURN NEW;
END;
$$;

/*
  WHY SECURITY DEFINER + fixed search_path: the function reads bob_app_config
  and calls net.http_post. SECURITY DEFINER ensures it runs with the definer's
  privileges regardless of the caller. The fixed search_path prevents
  search_path injection attacks.
*/
CREATE OR REPLACE FUNCTION public.notify_assessment_eval_worker()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'net'
AS $$
DECLARE
  v_url  text;
  v_auth text;
BEGIN
  SELECT value INTO v_url  FROM public.bob_app_config WHERE key = 'worker_url';
  SELECT value INTO v_auth FROM public.bob_app_config WHERE key = 'worker_auth';

  IF v_url IS NULL OR v_url = '' OR v_auth IS NULL
     OR v_auth = 'PASTE_SERVICE_ROLE_JWT_HERE' THEN
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


-- =============================================================================
-- 7. TRIGGERS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bob_sessions_set_updated_at'
  ) THEN
    CREATE TRIGGER bob_sessions_set_updated_at
      BEFORE UPDATE ON public.bob_sessions
      FOR EACH ROW EXECUTE FUNCTION public.tg_bob_sessions_set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bob_skill_levels_history_trigger'
  ) THEN
    CREATE TRIGGER bob_skill_levels_history_trigger
      AFTER INSERT OR UPDATE ON public.bob_skill_levels
      FOR EACH ROW EXECUTE FUNCTION public.bob_skill_levels_history_fn();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bob_assessment_queue_dispatch_trigger'
  ) THEN
    CREATE TRIGGER bob_assessment_queue_dispatch_trigger
      AFTER INSERT ON public.bob_assessment_queue
      FOR EACH ROW EXECUTE FUNCTION public.notify_assessment_eval_worker();
  END IF;
END $$;


-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all Bob tables (idempotent — ALTER TABLE ... ENABLE RLS is safe
-- to call on a table that already has RLS enabled).

ALTER TABLE public.bob_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_prompts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_prompts_snapshot_v1   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_generation_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_closed_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_vocabulary            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_word_images           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_skill_levels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_skill_level_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_app_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_assessment_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_english_frameworks ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- bob_sessions
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_sessions' AND policyname = 'bob_users_select_own_sessions') THEN
    CREATE POLICY bob_users_select_own_sessions ON public.bob_sessions
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_sessions' AND policyname = 'bob_users_insert_own_sessions') THEN
    CREATE POLICY bob_users_insert_own_sessions ON public.bob_sessions
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_sessions' AND policyname = 'bob_users_update_own_sessions') THEN
    CREATE POLICY bob_users_update_own_sessions ON public.bob_sessions
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_sessions' AND policyname = 'bob_users_delete_own_sessions') THEN
    CREATE POLICY bob_users_delete_own_sessions ON public.bob_sessions
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_messages
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_messages' AND policyname = 'bob_users_select_own_messages') THEN
    CREATE POLICY bob_users_select_own_messages ON public.bob_messages
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_messages' AND policyname = 'bob_users_insert_own_messages') THEN
    CREATE POLICY bob_users_insert_own_messages ON public.bob_messages
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_messages' AND policyname = 'bob_users_delete_own_messages') THEN
    CREATE POLICY bob_users_delete_own_messages ON public.bob_messages
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_prompts
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_prompts' AND policyname = 'bob_prompts_auth_select') THEN
    CREATE POLICY bob_prompts_auth_select ON public.bob_prompts
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_prompts' AND policyname = 'bob_prompts_anon_select') THEN
    CREATE POLICY bob_prompts_anon_select ON public.bob_prompts
      FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_prompts' AND policyname = 'bob_prompts_service_all') THEN
    CREATE POLICY bob_prompts_service_all ON public.bob_prompts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_prompts_snapshot_v1
-- WHY: dev had RLS disabled — security bug. Prod gets conservative policies.
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_prompts_snapshot_v1' AND policyname = 'bob_prompts_snapshot_v1_auth_select') THEN
    CREATE POLICY bob_prompts_snapshot_v1_auth_select ON public.bob_prompts_snapshot_v1
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_prompts_snapshot_v1' AND policyname = 'bob_prompts_snapshot_v1_service_all') THEN
    CREATE POLICY bob_prompts_snapshot_v1_service_all ON public.bob_prompts_snapshot_v1
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_generation_cache
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_generation_cache' AND policyname = 'authenticated_read_cache') THEN
    CREATE POLICY authenticated_read_cache ON public.bob_generation_cache
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_generation_cache' AND policyname = 'authenticated_insert_cache') THEN
    CREATE POLICY authenticated_insert_cache ON public.bob_generation_cache
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_generation_cache' AND policyname = 'authenticated_update_cache') THEN
    CREATE POLICY authenticated_update_cache ON public.bob_generation_cache
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_generation_cache' AND policyname = 'service_role_all_cache') THEN
    CREATE POLICY service_role_all_cache ON public.bob_generation_cache
      FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_closed_items
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_closed_items' AND policyname = 'Anyone authenticated can read closed items') THEN
    CREATE POLICY "Anyone authenticated can read closed items" ON public.bob_closed_items
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_vocabulary
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_vocabulary' AND policyname = 'bob_vocabulary_read_all') THEN
    CREATE POLICY bob_vocabulary_read_all ON public.bob_vocabulary
      FOR SELECT USING (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_word_images
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_word_images' AND policyname = 'bob_word_images_read_all') THEN
    CREATE POLICY bob_word_images_read_all ON public.bob_word_images
      FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_word_images' AND policyname = 'bob_word_images_insert_authenticated') THEN
    CREATE POLICY bob_word_images_insert_authenticated ON public.bob_word_images
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_word_images' AND policyname = 'bob_word_images_update_authenticated') THEN
    CREATE POLICY bob_word_images_update_authenticated ON public.bob_word_images
      FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_skill_levels
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_skill_levels' AND policyname = 'student_rw_own_skill_levels') THEN
    CREATE POLICY student_rw_own_skill_levels ON public.bob_skill_levels
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_skill_levels' AND policyname = 'teacher_read_skill_levels') THEN
    CREATE POLICY teacher_read_skill_levels ON public.bob_skill_levels
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM (profiles teacher
            JOIN profiles student ON student.organization_id = teacher.organization_id)
          WHERE teacher.id = auth.uid()
            AND teacher.role = ANY (ARRAY['teacher'::user_role, 'school_admin'::user_role, 'super_admin'::user_role])
            AND student.id = bob_skill_levels.user_id
        )
      );
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_skill_level_history
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_skill_level_history' AND policyname = 'student_read_own_history') THEN
    CREATE POLICY student_read_own_history ON public.bob_skill_level_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_skill_level_history' AND policyname = 'history_insert_trigger_only') THEN
    CREATE POLICY history_insert_trigger_only ON public.bob_skill_level_history
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_skill_level_history' AND policyname = 'teacher_read_history') THEN
    CREATE POLICY teacher_read_history ON public.bob_skill_level_history
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM (profiles teacher
            JOIN profiles student ON student.organization_id = teacher.organization_id)
          WHERE teacher.id = auth.uid()
            AND teacher.role = ANY (ARRAY['teacher'::user_role, 'school_admin'::user_role, 'super_admin'::user_role])
            AND student.id = bob_skill_level_history.user_id
        )
      );
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_app_config
/* WHY: dev had RLS disabled — security bug. This table holds worker_auth, a
   service-role JWT. No authenticated access: notify_assessment_eval_worker is
   SECURITY DEFINER and reads this table bypassing RLS, so the app role never
   needs SELECT here. service_role only. */
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_app_config' AND policyname = 'bob_app_config_service_all') THEN
    CREATE POLICY bob_app_config_service_all ON public.bob_app_config
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- bob_assessment_queue
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_assessment_queue' AND policyname = 'student_read_own_queue') THEN
    CREATE POLICY student_read_own_queue ON public.bob_assessment_queue
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bob_assessment_queue' AND policyname = 'bob_assessment_queue_user_insert_own') THEN
    CREATE POLICY bob_assessment_queue_user_insert_own ON public.bob_assessment_queue
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- audit_log
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Org admin reads audit log of own org') THEN
    CREATE POLICY "Org admin reads audit log of own org" ON public.audit_log
      FOR SELECT TO authenticated USING (
        organization_id IN (
          SELECT profiles.organization_id
          FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = ANY (ARRAY['school_admin'::user_role, 'super_admin'::user_role])
        )
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Service role writes audit log') THEN
    CREATE POLICY "Service role writes audit log" ON public.audit_log
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- student_english_frameworks
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_english_frameworks' AND policyname = 'student_read_own_frameworks') THEN
    CREATE POLICY student_read_own_frameworks ON public.student_english_frameworks
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================================================
-- 9. ROLLOUT GUARD — Bob disabled on all existing schools
-- =============================================================================

/*
  WHY: Belt-and-suspenders guarantee. The DEFAULT false above covers new rows.
  This UPDATE covers orgs that might already exist in the target DB with a NULL
  or stale value due to any edge case in the ALTER TABLE run. Bob rolls out
  per-school via the MIA admin panel — no school gets it on by default.
*/
UPDATE public.organizations SET is_bob_enabled = false;
