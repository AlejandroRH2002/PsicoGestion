# Entidad PacienteArchivo

La entidad `PacienteArchivo` guarda los documentos adjuntos de un paciente
(expediente, consentimiento informado, identificación, etc.). Un paciente
puede tener varios archivos; cada archivo pertenece a un solo paciente.

No aparece en la sección 3.4 del ERS: se agregó porque el formulario de
registro de pacientes solicita al menos un archivo adjunto y estos deben
conservarse junto al perfil.

## Estructura de la entidad

| Campo | Tipo de dato | Restricciones |
|---|---|---|
| `id_archivo` | SERIAL / INT | PRIMARY KEY, autogenerado |
| `id_paciente` | INT | NOT NULL, FOREIGN KEY → Paciente(id_paciente), ON DELETE RESTRICT |
| `nombre_original` | VARCHAR(255) | NOT NULL, nombre con el que se subió |
| `ruta` | TEXT | NOT NULL, UNIQUE, ruta relativa dentro de `UPLOADS_DIR` |
| `tipo` | VARCHAR(4) | NOT NULL, valores válidos: 'pdf', 'jpg', 'png' |
| `tamano_bytes` | INT | NOT NULL, mayor a 0 |
| `subido_en` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

## Observaciones de diseño

- El archivo se guarda en disco (`UPLOADS_DIR/pacientes/<uuid>.<tipo>`) con un
  nombre aleatorio; la base de datos solo guarda la ruta y los metadatos.
- `tipo` se determina leyendo la cabecera real del archivo, no la extensión
  ni el mimetype que envía el navegador. Máximo 5 MB por archivo.
- Por confidencialidad (RNF 3.2.7) estos archivos **no** se sirven desde
  `/uploads`; solo se descargan con sesión activa mediante
  `GET /pacientes/:id/archivos/:idArchivo`.
- Al registrar se exige al menos un archivo. En la edición se pueden agregar
  y quitar, pero no quitar el último.
- `ON DELETE RESTRICT`: los pacientes solo se dan de baja lógicamente, así que
  sus archivos se conservan.
