-- RF 5.1.14: dato de contacto para enviar la confirmación de cita. Opcional (no todos los
-- pacientes tienen correo) y sin UNIQUE: un tutor puede registrar el mismo correo para varios pacientes.
ALTER TABLE paciente
    ADD COLUMN IF NOT EXISTS correo VARCHAR(100);
