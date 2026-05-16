ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_bob_enabled BOOLEAN DEFAULT false;
COMMENT ON COLUMN organizations.is_bob_enabled IS 'Activates Bob pronunciation coach module for this organization';
