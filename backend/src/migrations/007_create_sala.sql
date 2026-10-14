-- EDT 1.4.2.5 / RF 4.1: catálogo de salas.
-- La expresión única aplica la misma normalización que la API: recorta,
-- compacta espacios y compara sin distinguir mayúsculas/minúsculas.
CREATE TABLE IF NOT EXISTS sala (
    id_sala SERIAL PRIMARY KEY,
    nombre_sala VARCHAR(10) NOT NULL,
    CONSTRAINT sala_nombre_no_vacio CHECK (btrim(nombre_sala) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS sala_nombre_normalizado_key
    ON sala (lower(regexp_replace(btrim(nombre_sala), '\s+', ' ', 'g')));
