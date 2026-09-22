# Base de datos de PsicoGestión

Esta carpeta reúne el diseño y la documentación de la base de datos de
**PsicoGestión**.

El modelo parte principalmente de la sección **3.4 Requerimientos de bases de
datos lógicas** del Documento de Especificación de Requerimientos de Software
(ERS). A partir de esos requerimientos, cada entidad se documenta de manera
individual para mantener clara la relación entre lo solicitado, las decisiones
de diseño y su posterior implementación.

Durante el desarrollo pueden existir ajustes derivados de revisiones con el
administrador o con el equipo. Cuando una decisión modifique o refine lo
establecido originalmente en el ERS, deberá quedar explicada en la
documentación de la entidad correspondiente.

## Organización

Cada entidad cuenta con su propia carpeta. La intención es mantener juntos el
análisis, la representación visual y la definición SQL relacionada con ella.

```text
base-de-datos/
├── README.md
│
├── secretaria/
│   ├── secretaria.md
│   ├── modelo-secretaria.png
│   └── secretaria.sql
│
├── terapeuta/
├── paciente/
├── sala/
├── bloque-horario/
├── disponibilidad-terapeuta/
├── disponibilidad-sala/
├── cita/
└── cita-bloque/