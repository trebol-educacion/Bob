-- =============================================================================
-- 75_bob_org_activity_grades_rpc.sql
--
-- RPC: bob_org_activity_grades(p_org_id uuid)
--
-- Returns per-(student, skill) aggregated grades for a given organization.
-- Intended to be called by MIA's teacher dashboard to populate student-grade
-- detail without scanning bob_activity_results in application code.
--
-- SECURITY INVOKER: the function runs with the privileges of the caller, so
-- the RLS policy teacher_read_activity_results continues to enforce that a
-- teacher only sees rows for students in their own organization. service_role
-- callers bypass RLS at the connection level and can call with any org_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bob_org_activity_grades(p_org_id uuid)
RETURNS TABLE (
  student_id      uuid,
  student_name    text,
  skill           text,
  activities_done bigint,
  avg_score_10    numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    bar.user_id                                     AS student_id,
    p.full_name::text                               AS student_name,
    bar.skill                                       AS skill,
    count(*)                                        AS activities_done,
    round(avg(bar.score_10) FILTER (WHERE bar.score_10 IS NOT NULL), 1) AS avg_score_10
  FROM public.bob_activity_results bar
  JOIN public.profiles p
    ON p.id = bar.user_id
   AND p.organization_id = p_org_id
   AND p.role = 'student'
  GROUP BY bar.user_id, p.full_name, bar.skill
  ORDER BY p.full_name, bar.skill;
$$;
