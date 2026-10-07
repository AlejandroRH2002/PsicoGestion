-- docs/base-de-datos/paciente-archivo/paciente-archivo.md § PacienteArchivo
-- Documentos adjuntos del paciente (PDF, JPG o PNG). El archivo vive en UPLOADS_DIR/<ruta>
-- y solo se descarga mediante GET /pacientes/:id/archivos/:idArchivo (con sesión).
CREATE TABLE IF NOT EXISTS paciente_archivo (
    id_archivo SERIAL PRIMARY KEY,
    id_paciente INT NOT NULL REFERENCES paciente (id_paciente) ON DELETE RESTRICT,
    nombre_original VARCHAR(255) NOT NULL,
    ruta TEXT NOT NULL UNIQUE,
    tipo VARCHAR(4) NOT NULL CHECK (tipo IN ('pdf', 'jpg', 'png')),
    tamano_bytes INT NOT NULL CHECK (tamano_bytes > 0),
    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS paciente_archivo_id_paciente_idx ON paciente_archivo (id_paciente);
