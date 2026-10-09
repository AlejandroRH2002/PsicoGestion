CREATE TABLE IF NOT EXISTS sala (
    id_sala SERIAL PRIMARY KEY,
    nombre_sala VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bloque_horario (
    id_bloque SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    CHECK (hora_fin > hora_inicio)
);

CREATE TABLE IF NOT EXISTS disponibilidad_terapeuta (
    id_terapeuta INT NOT NULL
        REFERENCES terapeuta (id_terapeuta) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,
    PRIMARY KEY (id_terapeuta, id_bloque)
);

CREATE TABLE IF NOT EXISTS disponibilidad_sala (
    id_sala INT NOT NULL
        REFERENCES sala (id_sala) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,
    PRIMARY KEY (id_sala, id_bloque)
);

DO $$
BEGIN
    CREATE TYPE estado_cita AS ENUM ('Pendiente', 'Cancelada', 'Vencida');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS cita (
    id_cita SERIAL PRIMARY KEY,
    id_paciente INT NOT NULL
        REFERENCES paciente (id_paciente) ON DELETE CASCADE,
    id_terapeuta INT NOT NULL
        REFERENCES terapeuta (id_terapeuta) ON DELETE CASCADE,
    id_sala INT NOT NULL
        REFERENCES sala (id_sala) ON DELETE CASCADE,
    folio VARCHAR(20) NOT NULL UNIQUE,
    estado estado_cita NOT NULL
);

CREATE TABLE IF NOT EXISTS cita_bloque (
    id_cita INT NOT NULL
        REFERENCES cita (id_cita) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,
    PRIMARY KEY (id_cita, id_bloque)
);

CREATE INDEX IF NOT EXISTS bloque_horario_fecha_idx ON bloque_horario (fecha, hora_inicio);
CREATE INDEX IF NOT EXISTS cita_bloque_id_bloque_idx ON cita_bloque (id_bloque);
