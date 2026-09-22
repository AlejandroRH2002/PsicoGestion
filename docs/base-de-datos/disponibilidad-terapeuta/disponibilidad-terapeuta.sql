CREATE TABLE disponibilidad_terapeuta (
    id_terapeuta INT NOT NULL
        REFERENCES terapeuta (id_terapeuta) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,

    PRIMARY KEY (id_terapeuta, id_bloque)
);
