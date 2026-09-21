CREATE TABLE secretaria (
    id_secretaria SERIAL PRIMARY KEY,

    nombres VARCHAR(50) NOT NULL,
    apellido_paterno VARCHAR(50) NOT NULL,
    apellido_materno VARCHAR(50),

    telefono VARCHAR(15) NOT NULL UNIQUE,
    correo_electronico VARCHAR(100) NOT NULL UNIQUE,

    contrasena_hash VARCHAR(255) NOT NULL
);
