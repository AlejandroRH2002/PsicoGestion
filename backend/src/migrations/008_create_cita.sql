-- RF 5.1–5.4: citas, bloques horarios y su relación.
-- El horario de una cita no vive en `cita`: se obtiene de los bloques de 30 min
-- asociados en `cita_bloque`. Los bloques se crean bajo demanda y se comparten
-- entre citas (UNIQUE fecha/hora), por eso la ocupación se decide por el estado
-- de la cita y no por la existencia del bloque.
-- Las FK hacia paciente/terapeuta/sala son RESTRICT: esas entidades se dan de
-- baja lógicamente y el historial de citas debe conservarse (docs/base-de-datos/cita).
CREATE TABLE IF NOT EXISTS bloque_horario (
    id_bloque SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    CONSTRAINT bloque_horario_orden CHECK (hora_fin > hora_inicio),
    CONSTRAINT bloque_horario_unico UNIQUE (fecha, hora_inicio, hora_fin)
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
    id_paciente INT NOT NULL REFERENCES paciente (id_paciente) ON DELETE RESTRICT,
    id_terapeuta INT NOT NULL REFERENCES terapeuta (id_terapeuta) ON DELETE RESTRICT,
    id_sala INT NOT NULL REFERENCES sala (id_sala) ON DELETE RESTRICT,
    -- RF 5.1.12: CIT-AAAA-NNNNN, derivado del id (nunca colisiona). Se asigna en la misma transacción del INSERT.
    folio VARCHAR(20) UNIQUE,
    estado estado_cita NOT NULL DEFAULT 'Pendiente',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cita_bloque (
    id_cita INT NOT NULL REFERENCES cita (id_cita) ON DELETE CASCADE,
    id_bloque INT NOT NULL REFERENCES bloque_horario (id_bloque) ON DELETE RESTRICT,
    PRIMARY KEY (id_cita, id_bloque)
);

CREATE INDEX IF NOT EXISTS bloque_horario_fecha_idx ON bloque_horario (fecha, hora_inicio);
CREATE INDEX IF NOT EXISTS cita_bloque_id_bloque_idx ON cita_bloque (id_bloque);
CREATE INDEX IF NOT EXISTS cita_estado_idx ON cita (estado);
CREATE INDEX IF NOT EXISTS cita_terapeuta_idx ON cita (id_terapeuta);
CREATE INDEX IF NOT EXISTS cita_sala_idx ON cita (id_sala);
CREATE INDEX IF NOT EXISTS cita_paciente_idx ON cita (id_paciente);
