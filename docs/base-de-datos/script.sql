-- =====================================================
-- PsicoGestión - Esquema de base de datos (PostgreSQL)
-- =====================================================

-- 1. Entidades independientes

CREATE TABLE secretaria (
    id_secretaria SERIAL PRIMARY KEY,

    nombres VARCHAR(50) NOT NULL,
    apellido_paterno VARCHAR(50) NOT NULL,
    apellido_materno VARCHAR(50),

    telefono VARCHAR(15) NOT NULL UNIQUE,
    correo_electronico VARCHAR(100) NOT NULL UNIQUE,

    contrasena_hash VARCHAR(255) NOT NULL
);

CREATE TABLE terapeuta (
    id_terapeuta SERIAL PRIMARY KEY,

    nombre_completo VARCHAR(50) NOT NULL,

    telefono VARCHAR(15) NOT NULL UNIQUE,
    correo_electronico VARCHAR(100) NOT NULL UNIQUE
        CHECK (correo_electronico ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

    fecha_nacimiento DATE
        CHECK (fecha_nacimiento < CURRENT_DATE),
    cedula_profesional VARCHAR(20) NOT NULL UNIQUE,

    foto_perfil TEXT
);

CREATE TABLE paciente (
    id_paciente SERIAL PRIMARY KEY,

    nombre_completo VARCHAR(50) NOT NULL,

    curp CHAR(18) NOT NULL UNIQUE,
    sexo CHAR(1) NOT NULL CHECK (sexo IN ('M', 'F', 'O')),
    fecha_nacimiento DATE NOT NULL CHECK (fecha_nacimiento < CURRENT_DATE),

    telefono VARCHAR(15) NOT NULL UNIQUE,

    fecha_registro TIMESTAMP NOT NULL DEFAULT NOW(),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sala (
    id_sala SERIAL PRIMARY KEY,

    nombre_sala VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE bloque_horario (
    id_bloque SERIAL PRIMARY KEY,

    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,

    CHECK (hora_fin > hora_inicio)
);

-- 2. Disponibilidad

CREATE TABLE disponibilidad_terapeuta (
    id_terapeuta INT NOT NULL
        REFERENCES terapeuta (id_terapeuta) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,

    PRIMARY KEY (id_terapeuta, id_bloque)
);

CREATE TABLE disponibilidad_sala (
    id_sala INT NOT NULL
        REFERENCES sala (id_sala) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,

    PRIMARY KEY (id_sala, id_bloque)
);

-- 3. Citas

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

CREATE TABLE cita_bloque (
    id_cita INT NOT NULL
        REFERENCES cita (id_cita) ON DELETE CASCADE,
    id_bloque INT NOT NULL
        REFERENCES bloque_horario (id_bloque) ON DELETE CASCADE,

    PRIMARY KEY (id_cita, id_bloque)
);
