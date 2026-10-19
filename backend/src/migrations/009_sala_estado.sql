-- RF 4.2: eliminar sala es una baja lógica. Las citas referencian la sala (FK RESTRICT) y el
-- historial debe conservarse, así que la fila se queda y solo deja de ofrecerse.
ALTER TABLE sala
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMPTZ;

ALTER TABLE sala DROP CONSTRAINT IF EXISTS sala_baja_con_fecha;
ALTER TABLE sala
    ADD CONSTRAINT sala_baja_con_fecha CHECK (activo OR fecha_baja IS NOT NULL);

-- El nombre solo es único entre salas activas: una sala eliminada libera su nombre.
-- Se conserva el nombre del índice porque sala.service.js#mapearError lo reconoce.
DROP INDEX IF EXISTS sala_nombre_normalizado_key;
CREATE UNIQUE INDEX sala_nombre_normalizado_key
    ON sala (lower(regexp_replace(btrim(nombre_sala), '\s+', ' ', 'g')))
    WHERE activo;
