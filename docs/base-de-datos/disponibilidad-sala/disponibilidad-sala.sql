CREATE TABLE disponibilidad_sala (
    id_sala INT NOT NULL
        REFERENCES sala (id_sala) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,

    PRIMARY KEY (id_sala, id_bloque)
);
