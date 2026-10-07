CREATE TABLE paciente_archivo (
    id_archivo SERIAL PRIMARY KEY,

    id_paciente INT NOT NULL REFERENCES paciente (id_paciente) ON DELETE RESTRICT,

    nombre_original VARCHAR(255) NOT NULL,
    ruta TEXT NOT NULL UNIQUE,
    tipo VARCHAR(4) NOT NULL CHECK (tipo IN ('pdf', 'jpg', 'png')),
    tamano_bytes INT NOT NULL CHECK (tamano_bytes > 0),

    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX paciente_archivo_id_paciente_idx ON paciente_archivo (id_paciente);
