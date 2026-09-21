CREATE TABLE cita_bloque (
    id_cita INT NOT NULL
        REFERENCES cita (id_cita) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,

    PRIMARY KEY (id_cita, id_bloque)
);
