-- RF 1.4 Recuperación de cuenta: códigos de verificación enviados por correo.
-- El código nunca se guarda en claro, solo su hash (igual que password_hash).
-- Se mantiene en una tabla aparte porque es un dato temporal de la lógica de
-- recuperación y no un atributo permanente de la secretaria
-- (docs/base-de-datos/secretaria/secretaria.md).
CREATE TABLE IF NOT EXISTS codigo_recuperacion (
    id_codigo SERIAL PRIMARY KEY,
    id_secretaria INT NOT NULL REFERENCES secretaria (id_secretaria) ON DELETE CASCADE,
    codigo_hash TEXT NOT NULL,
    intentos SMALLINT NOT NULL DEFAULT 0,
    expira_en TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codigo_recuperacion_secretaria
    ON codigo_recuperacion (id_secretaria, creado_en DESC);
