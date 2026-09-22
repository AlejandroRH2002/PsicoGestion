CREATE TYPE estado_cita AS ENUM ('Pendiente', 'Cancelada', 'Vencida');

CREATE TABLE cita (
    id_cita SERIAL PRIMARY KEY,

    id_paciente INT NOT NULL
        REFERENCES paciente (id_paciente) ON DELETE CASCADE,
    id_terapeuta INT NOT NULL
        REFERENCES terapeuta (id_terapeuta) ON DELETE CASCADE,
    id_sala INT NOT NULL
        REFERENCES sala (id_sala) ON DELETE CASCADE,

    folio VARCHAR(10) NOT NULL UNIQUE,
    estado estado_cita NOT NULL
);
