create table public.bob_challenge_attempts (
  id                uuid        not null default gen_random_uuid() primary key,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  framework         text        not null,
  exam_id           text        not null,
  exam_title        text        not null,
  objective_correct int         not null default 0,
  objective_total   int         not null default 0,
  answers           jsonb       not null,
  results           jsonb       not null,
  created_at        timestamptz not null default now()
);

create index idx_bob_challenge_attempts_user_created
  on public.bob_challenge_attempts (user_id, created_at desc);

alter table public.bob_challenge_attempts enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'bob_challenge_attempts'
      AND policyname = 'student_rw_own_challenge_attempts') THEN
    CREATE POLICY student_rw_own_challenge_attempts ON public.bob_challenge_attempts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename = 'bob_challenge_attempts'
      AND policyname = 'teacher_read_challenge_attempts') THEN
    CREATE POLICY teacher_read_challenge_attempts ON public.bob_challenge_attempts
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM (profiles teacher
            JOIN profiles student ON student.organization_id = teacher.organization_id)
          WHERE teacher.id = auth.uid()
            AND teacher.role = ANY (ARRAY['teacher'::user_role, 'school_admin'::user_role, 'super_admin'::user_role])
            AND student.id = bob_challenge_attempts.user_id
        )
      );
  END IF;
END $$;
