CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_user_id uuid NOT NULL,
  target_user_id uuid,
  organization_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_target_user_idx ON audit_log(target_user_id);
CREATE INDEX audit_log_org_idx ON audit_log(organization_id);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admin reads audit log of own org" ON audit_log
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('school_admin','super_admin')
    )
  );
CREATE POLICY "Service role writes audit log" ON audit_log
  FOR INSERT TO service_role WITH CHECK (true);
COMMENT ON TABLE audit_log IS 'Registro de acciones administrativas: supresión de datos del alumno, cambios de flag tenant, etc.';
