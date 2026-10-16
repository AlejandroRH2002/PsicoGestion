ALTER TABLE paciente DROP CONSTRAINT IF EXISTS paciente_fecha_nacimiento_check;

ALTER TABLE paciente
  ADD CONSTRAINT paciente_fecha_nacimiento_check
  CHECK (fecha_nacimiento < ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Merida')::date));