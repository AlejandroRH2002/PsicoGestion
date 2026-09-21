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
