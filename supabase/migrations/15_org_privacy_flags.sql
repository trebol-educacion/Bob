ALTER TABLE organizations
  ADD COLUMN allow_voice_storage  boolean NOT NULL DEFAULT false,
  ADD COLUMN allow_data_retention boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN organizations.allow_voice_storage IS 'Tenant flag: si true, se almacena el audio crudo del menor en bob_messages.user_audio. Default false por D-C2/D-C3.';
COMMENT ON COLUMN organizations.allow_data_retention IS 'Tenant flag: si true, el histórico del alumno se conserva al pedir baja (sino, supresión real). Default false por D-C2.';
