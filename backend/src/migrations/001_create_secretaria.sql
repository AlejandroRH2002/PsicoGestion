-- specs/00-modelo-de-datos.md § Secretaria
-- Nota: el modelo lógico llama a la columna "contraseña"; aquí se implementa
-- como password_hash porque nunca se almacena la contraseña en claro (RNF de
-- seguridad de specs/00-constitucion.md), solo su hash.
CREATE TABLE IF NOT EXISTS secretaria (
    id_secretaria SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(50) NOT NULL,
    telefono VARCHAR(15) NOT NULL UNIQUE,
    correo_electronico VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
