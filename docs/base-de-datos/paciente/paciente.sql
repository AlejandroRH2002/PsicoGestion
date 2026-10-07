CREATE TABLE paciente (
    id_paciente SERIAL PRIMARY KEY,

    nombre_completo VARCHAR(50) NOT NULL,

    curp CHAR(18) NOT NULL UNIQUE,
    sexo CHAR(1) NOT NULL CHECK (sexo IN ('M', 'F', 'O')),
    fecha_nacimiento DATE NOT NULL CHECK (fecha_nacimiento < CURRENT_DATE),

    telefono VARCHAR(15) NOT NULL UNIQUE,

    fecha_registro TIMESTAMP NOT NULL DEFAULT NOW(),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_baja TIMESTAMPTZ,

    CONSTRAINT paciente_baja_con_fecha CHECK (activo OR fecha_baja IS NOT NULL)
);
