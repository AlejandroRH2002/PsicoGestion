-- RF 3.3.1: baja lógica de pacientes; nunca se borran porque citas e historial dependen de id_paciente.
-- Un paciente dado de baja conserva su CURP y teléfono (siguen siendo UNIQUE).
ALTER TABLE paciente
    ADD COLUMN fecha_baja TIMESTAMPTZ;

UPDATE paciente SET fecha_baja = NOW() WHERE NOT activo;

ALTER TABLE paciente
    ADD CONSTRAINT paciente_baja_con_fecha CHECK (activo OR fecha_baja IS NOT NULL);
