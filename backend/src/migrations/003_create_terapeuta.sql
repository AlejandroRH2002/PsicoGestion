-- docs/base-de-datos/terapeuta/ (DBD.md § Terapeuta), RF 2.1.1-2.1.13.
-- fecha_nacimiento es NOT NULL porque el formulario de registro la exige.
-- La validación de dimensiones mínimas de la foto (200x200 px) se hace en la aplicación;
-- foto_perfil guarda la ruta relativa del archivo dentro de UPLOADS_DIR.
CREATE TABLE IF NOT EXISTS terapeuta (
    id_terapeuta SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(50) NOT NULL,
    telefono VARCHAR(15) NOT NULL UNIQUE,
    correo_electronico VARCHAR(100) NOT NULL UNIQUE
        CHECK (correo_electronico ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    fecha_nacimiento DATE NOT NULL
        CHECK (fecha_nacimiento < CURRENT_DATE),
    cedula_profesional VARCHAR(20) NOT NULL UNIQUE,
    foto_perfil TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
