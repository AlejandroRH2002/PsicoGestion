CREATE TABLE bloque_horario (
    id_bloque SERIAL PRIMARY KEY,

    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,

    CHECK (hora_fin > hora_inicio)
);
