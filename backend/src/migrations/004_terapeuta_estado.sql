-- Baja lógica de terapeutas: nunca se borran porque citas e historial dependen de id_terapeuta.
-- Un terapeuta dado de baja conserva su correo, teléfono y cédula (siguen siendo UNIQUE).
ALTER TABLE terapeuta
    ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN fecha_baja TIMESTAMPTZ,
    ADD CONSTRAINT terapeuta_baja_con_fecha CHECK (activo OR fecha_baja IS NOT NULL);
