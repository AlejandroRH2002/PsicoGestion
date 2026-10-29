# Reporte de auditoría de gestión de configuración — PsicoGestión

## 1. Datos de la auditoría

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/AlejandroRH2002/PsicoGestion |
| Fecha de recolección | 2026-10-29 |
| Commit de `main` auditado | [`112b591`](https://github.com/AlejandroRH2002/PsicoGestion/commit/112b591083cc9d8fc0e1b7e73089b9593377c21a) |
| Alcance | Todo el historial: ramas locales, remotas y etiquetas (sin stash); todas las ramas remotas, incluidas `docs` y `manual`; todos los PR |
| Método | Recolección automática con `scripts/auditoria/recolectar.mjs` (git + GitHub CLI) y revisión manual de los casos marcados |
| Evidencia cruda | `evidencia-auditoria.json` |

## 2. Resumen de cumplimiento

| Criterio | Descripción | Fuente | Cumple | Total | % |
|---|---|---|---|---|---|
| C1 | Sin commits directos a `main` | README §3, §13 | 10 | 15 | 67 % |
| C2 | Ramas con prefijo `feature/` o `fix/` | README §3.1–3.2 | 21 | 24 | 88 % |
| C3a | Commits con formato `tipo: descripción` | README §9 | 58 | 69 | 84 % |
| C3b | Commits trazables a RF/RNF o tarea | CLAUDE.md / SQAP | 13 | 69 | 19 % |
| C4 | Integraciones a `main` mediante PR | README §4, §11 | 10 | 15 | 67 % |
| C5 | PR fusionados con aprobación de otra persona | README §12–13 | 0 | 14 | 0 % |
| C6 | PR con la descripción de la plantilla completa | README §11 | 5 | 19 | 26 % |
| C7 | Ramas remotas vigentes (no quedaron tras fusionarse) | README §14, Regla 2 | 6 | 21 | 29 % |
| C8 | `main` protegida en GitHub | README §3, §13 | 0 | 0 | n/a |

> C1 y C4 cuentan los commits del historial de primer padre de `main`. C7 es informativo: una rama fusionada que sigue en el remoto debió borrarse.

## 3. Hallazgos por criterio

### C1 — Commits directos a `main`

| Commit | Autor | Fecha | Asunto | Nota |
|---|---|---|---|---|
| [`112b591`](https://github.com/AlejandroRH2002/PsicoGestion/commit/112b591083cc9d8fc0e1b7e73089b9593377c21a) | Emiliano Antonio Arceo Márquez | 2026-10-23 | Add files via upload | subido desde la interfaz web de GitHub |
| [`3a4776d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/3a4776d8b3e88ac22fa76d3b189a725945134735) | AlejandroRH2002 | 2026-09-01 | docs: actualizar README y estructura del repositorio según ACS |  |
| [`00e8385`](https://github.com/AlejandroRH2002/PsicoGestion/commit/00e838562cd1f6c572874e091256fbd527f9a531) | AlejandroRH2002 | 2026-09-01 | docs: actualización de la descripcion del proyecto |  |
| [`6c27514`](https://github.com/AlejandroRH2002/PsicoGestion/commit/6c275142e86b8e89015145cecb3e05987889341a) | AlejandroRH2002 | 2026-08-28 | docs: agregar guia de gestion de configuracion con GitHub | configuración inicial (antes o igual a la guía de GitHub) |
| [`706f60b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/706f60b2f237d506405929907d081a63a325efe4) | AlejandroRH2002 | 2026-08-20 | Initial commit | configuración inicial (antes o igual a la guía de GitHub) |

### C2 — Nomenclatura de ramas

**No conformes** (sin prefijo `feature/` o `fix/`; incluye `docs` y `manual`):

| Rama | Dónde aparece |
|---|---|
| `docs` | remoto |
| `manual` | remoto, PR #20 |
| `frontend-feature-registro` | PR #1 |

**Observaciones de estilo** (prefijo correcto, pero con mayúsculas, acentos o ñ; los ejemplos del README usan solo minúsculas y guiones):

| Rama | Dónde aparece |
|---|---|
| `feature/PG-REQ-001-busqueda-pacientes-curp` | remoto, PR #14 |
| `feature/manual-tecnico-v0.2.0` | remoto, PR #21 |
| `feature/recuperar-contraseña` | remoto, PR #2, PR #5 |

<details>
<summary>Ramas conformes (21)</summary>

- `feature/PG-REQ-001-busqueda-pacientes-curp` (remoto, PR #14)
- `feature/agenda-citas` (remoto)
- `feature/agenda-inicio` (remoto, PR #18)
- `feature/base-de-datos` (remoto, PR #4)
- `feature/corregir-errores-auditoria` (remoto)
- `feature/creacion-pacientes` (remoto, PR #12)
- `feature/editar-pacientes` (remoto, PR #10, PR #13)
- `feature/editar-terapeutas` (remoto, PR #8)
- `feature/gestion-citas` (remoto)
- `feature/gestion-citas-v2` (remoto, PR #17)
- `feature/gestion-terapeutas` (remoto)
- `feature/manual-tecnico-v0.2.0` (remoto, PR #21)
- `feature/perfil-baja-pacientes` (remoto, PR #15)
- `feature/recuperar-contraseña` (remoto, PR #2, PR #5)
- `feature/registro-disponibilidad-salas` (remoto, PR #16)
- `feature/registro-terapeutas` (remoto, PR #7)
- `feature/registro-usuarios` (remoto, PR #3)
- `feature/validacion-cedula-profesional` (remoto)
- `fix/validaciones-pacientes` (remoto)
- `feature/migraciones-pacientes-terapeutas` (PR #6)
- `fix/observaciones-fca-02` (PR #19)
</details>

### C3a — Formato de los mensajes de commit

| Commit | Autor | Fecha | Asunto | Motivo |
|---|---|---|---|---|
| [`112b591`](https://github.com/AlejandroRH2002/PsicoGestion/commit/112b591083cc9d8fc0e1b7e73089b9593377c21a) | Emiliano Antonio Arceo Márquez | 2026-10-23 | Add files via upload | sin prefijo `tipo: descripción` |
| [`5bbbfc0`](https://github.com/AlejandroRH2002/PsicoGestion/commit/5bbbfc0d333edcff84ec3fb04df335c827d8944f) | Emiliano Antonio Arceo Márquez | 2026-10-23 | agregar manual de usuario PsicoGestión v0.2.0 | sin prefijo `tipo: descripción` |
| [`7324e40`](https://github.com/AlejandroRH2002/PsicoGestion/commit/7324e40ccddb9ed9b628bb9b56f30f22f4f85857) | Tyrone J | 2026-10-16 | Fix: corregir errores resaltados en auditoria realizada | tipo con mayúsculas (`Fix`) |
| [`ba0e69b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ba0e69bab64533e0393f16b01600762768c5f4b5) | Emiliano | 2026-10-13 | style(salas): normalizar finales de archivo | tipo no definido en README (`style`) |
| [`c577b1d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c577b1d79f023ad00413d71d18f27190f133fec9) | Alexandercp7 | 2026-10-09 | refactor(citas): mover vista de calendario a /citas/calendario y actualizar sidebar | tipo no definido en README (`refactor`) |
| [`495a3e2`](https://github.com/AlejandroRH2002/PsicoGestion/commit/495a3e2173db56f83c0af2e3262a90d1c942f031) | Juan Daniel Kao Pech | 2026-09-30 | chore: remove VSCode settings file | tipo no definido en README (`chore`) |
| [`ce1da55`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ce1da557b7b24f8c0b39bfc595e5c96853bbe0c1) | Juan Daniel Kao Pech | 2026-09-22 | build: :arrow_up: add .env.example file for frontend | tipo no definido en README (`build`) |
| [`be4f6a6`](https://github.com/AlejandroRH2002/PsicoGestion/commit/be4f6a6ba3a44b928891174b99c55387e0c5ba09) | Juan Daniel Kao Pech | 2026-09-22 | style: :lipstick: update login/registration pages for PsicoGestión branding | tipo no definido en README (`style`) |
| [`dad4c93`](https://github.com/AlejandroRH2002/PsicoGestion/commit/dad4c93f8943e2208b9a0439272e81276182931a) | Juan Daniel Kao Pech | 2026-09-21 | Add database schema for PsicoGestion | sin prefijo `tipo: descripción` |
| [`ec0d79b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ec0d79b5db765ff6a88f83cd17c009bfc1e40374) | Tyrone Johnson | 2026-09-11 | feature: agregar páginas de login y registro de usuarios | tipo desconocido (`feature`) |
| [`706f60b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/706f60b2f237d506405929907d081a63a325efe4) | AlejandroRH2002 | 2026-08-20 | Initial commit | sin prefijo `tipo: descripción` |

Distribución de tipos en los commits conformes: `docs`: 11 · `feat`: 32 · `test`: 7 · `fix`: 8

### C3b — Trazabilidad de commits a requerimientos

13 de 69 commits (sin contar merges) citan un RF/RNF o un identificador `PG-REQ`.

<details>
<summary>Commits sin referencia (56)</summary>

| Commit | Autor | Fecha | Asunto |
|---|---|---|---|
| [`4fc4578`](https://github.com/AlejandroRH2002/PsicoGestion/commit/4fc457864e7cdcadc92f4f687f692a6bd5aa82ee) | Emiliano Antonio Arceo Márquez | 2026-10-28 | docs: actualizar manual técnico v0.2.0 |
| [`112b591`](https://github.com/AlejandroRH2002/PsicoGestion/commit/112b591083cc9d8fc0e1b7e73089b9593377c21a) | Emiliano Antonio Arceo Márquez | 2026-10-23 | Add files via upload |
| [`5bbbfc0`](https://github.com/AlejandroRH2002/PsicoGestion/commit/5bbbfc0d333edcff84ec3fb04df335c827d8944f) | Emiliano Antonio Arceo Márquez | 2026-10-23 | agregar manual de usuario PsicoGestión v0.2.0 |
| [`fd45806`](https://github.com/AlejandroRH2002/PsicoGestion/commit/fd458069ca1c2944af79f65100b8ff043f619002) | Juan Daniel Kao Pech | 2026-10-18 | feat(sesion): confirmar antes de cerrar sesión |
| [`50b982b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/50b982bc255f262cf6e15baaef85fcad16196dbb) | Juan Daniel Kao Pech | 2026-10-17 | docs: documentar correcciones FCA-02 (salas, citas, agenda) |
| [`bde7f4d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/bde7f4d1f9898ba11062f73b28c0aa17cd65efcb) | Juan Daniel Kao Pech | 2026-10-17 | fix(frontend): mensaje en español cuando no hay conexión con el servidor |
| [`7324e40`](https://github.com/AlejandroRH2002/PsicoGestion/commit/7324e40ccddb9ed9b628bb9b56f30f22f4f85857) | Tyrone J | 2026-10-16 | Fix: corregir errores resaltados en auditoria realizada |
| [`e437d88`](https://github.com/AlejandroRH2002/PsicoGestion/commit/e437d886a58b33e67c94d5d3006d05758f39f5c9) | Juan Daniel Kao Pech | 2026-10-14 | docs(agenda): documentar contrato, decisiones y trazabilidad |
| [`c5ed6d7`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c5ed6d71f972a4e5dd7c7b4164d2723df9bcbe7d) | Juan Daniel Kao Pech | 2026-10-14 | test(agenda): cubrir rangos por vista, filtros y estados visibles |
| [`c02d84f`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c02d84f8c3409200bedcec9d63bde7b601a03b8d) | Juan Daniel Kao Pech | 2026-10-13 | docs(citas): documentar contrato, decisiones y trazabilidad |
| [`ba0e69b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ba0e69bab64533e0393f16b01600762768c5f4b5) | Emiliano | 2026-10-13 | style(salas): normalizar finales de archivo |
| [`cc90b87`](https://github.com/AlejandroRH2002/PsicoGestion/commit/cc90b87abb826d2433abdb0bc3a92f809552bc87) | Emiliano | 2026-10-13 | docs(salas): documentar contrato y trazabilidad |
| [`392e335`](https://github.com/AlejandroRH2002/PsicoGestion/commit/392e335c4a67d60e0e1ead3c72ff26f691687a48) | Emiliano | 2026-10-13 | test(salas): cubrir registro y reglas de disponibilidad |
| [`ef7c8e5`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ef7c8e5ce97d833ef2fdc2cfcd75f5481284e54b) | Emiliano | 2026-10-13 | feat(salas): implementar registro y disponibilidad |
| [`867feb3`](https://github.com/AlejandroRH2002/PsicoGestion/commit/867feb3eb04ba4ae9dc0935b175262b9ce3990ea) | Alexandercp7 | 2026-10-09 | fix(agenda): corregir tipo para asignacion de textContent en vista de mes |
| [`c9b7e48`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c9b7e48a7562ba32f9f657279406f853b972a381) | Alexandercp7 | 2026-10-09 | feat(citas): implementar directorio, modificacion de citas y conexion con backend |
| [`c577b1d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c577b1d79f023ad00413d71d18f27190f133fec9) | Alexandercp7 | 2026-10-09 | refactor(citas): mover vista de calendario a /citas/calendario y actualizar sidebar |
| [`73b114e`](https://github.com/AlejandroRH2002/PsicoGestion/commit/73b114ecb811a727338e33b04d5422522e85ecf2) | Tyrone Johnson | 2026-10-09 | feat: flujo e interfaz de registro de citas |
| [`88aa649`](https://github.com/AlejandroRH2002/PsicoGestion/commit/88aa6490e90475bd79de898d2d33ce45e4f0f7b1) | Alexandercp7 | 2026-10-09 | feat(citas): implementar modulo de agenda modular y conectar ruta en el sidebar |
| [`fde93f1`](https://github.com/AlejandroRH2002/PsicoGestion/commit/fde93f10275157437f56ffc51a0316a532b894f7) | Juan Daniel Kao Pech | 2026-10-07 | docs: entidad paciente_archivo y fecha_baja de paciente |
| [`58a72ee`](https://github.com/AlejandroRH2002/PsicoGestion/commit/58a72ee54670f1c46837e7053633a0dad6c87651) | Juan Daniel Kao Pech | 2026-10-07 | test(pacientes): pruebas de integración del módulo y de detección de adjuntos |
| [`4ed1c49`](https://github.com/AlejandroRH2002/PsicoGestion/commit/4ed1c49f2f3376c7c0d752463836e266760873db) | AlejandroRH2002 | 2026-10-06 | fix: priorizar existencia y edad antes de duplicados al editar pacientes |
| [`13e4254`](https://github.com/AlejandroRH2002/PsicoGestion/commit/13e4254cf0a078a60128ef91ceff1912cd54e1fb) | AlejandroRH2002 | 2026-10-06 | fix: manejar conflictos UNIQUE desconocidos en pacientes |
| [`d33473b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/d33473b5100f8512eb403d50235b272ab95d4ebd) | AlejandroRH2002 | 2026-10-06 | fix: validar cuerpos no objeto en solicitudes de pacientes |
| [`9f1c5fa`](https://github.com/AlejandroRH2002/PsicoGestion/commit/9f1c5fa3b9ba594f0e6f5835f32c14513e9c0fc8) | AlejandroRH2002 | 2026-10-06 | fix: responder 400 seguro ante errores de parseo JSON |
| [`13d4aae`](https://github.com/AlejandroRH2002/PsicoGestion/commit/13d4aae1fc931358692c0436dd0abdf405e921e5) | AlejandroRH2002 | 2026-10-06 | fix: validar edad minima de pacientes al crear y editar |
| [`7dfdfaf`](https://github.com/AlejandroRH2002/PsicoGestion/commit/7dfdfaf9d657742e77e2a0d6d28798062de57702) | AlejandroRH2002 | 2026-10-06 | test: usar fechas relativas y verificar edad al editar pacientes |
| [`6ddf305`](https://github.com/AlejandroRH2002/PsicoGestion/commit/6ddf305e51a771170845482a294949ac90784213) | AlejandroRH2002 | 2026-10-06 | test: agregar pruebas de edicion, unicidad y edad de pacientes |
| [`f4b666f`](https://github.com/AlejandroRH2002/PsicoGestion/commit/f4b666fcb1a46f53ee306b70df0bb36813c97bce) | Alexandercp7 | 2026-10-05 | feat(frontend): integrar AppLayout, validaciones de edicion y centro de notificaciones |
| [`6fe2851`](https://github.com/AlejandroRH2002/PsicoGestion/commit/6fe2851c00039dd87e0d9fa063af08337d97a3d8) | Alexandercp7 | 2026-10-05 | feat(pacientes): implementar edicion de pacientes, soporte multipart y centro de notificaciones |
| [`1699805`](https://github.com/AlejandroRH2002/PsicoGestion/commit/16998052d2391efc9675e63693018c9e8de46453) | AlejandroRH2002 | 2026-10-02 | feat(pacientes): add patient list and edit flow |
| [`94e2396`](https://github.com/AlejandroRH2002/PsicoGestion/commit/94e2396f5c540064a0fa4ca4730846a873e22f78) | Juan Daniel Kao Pech | 2026-10-01 | docs: agregar TEST_DATABASE_URL a .env.example para las pruebas de integración |
| [`f2790cc`](https://github.com/AlejandroRH2002/PsicoGestion/commit/f2790cca7a5d6f399f11d1bbe441ab1ffa5c9ebb) | Juan Daniel Kao Pech | 2026-10-01 | feat: add therapist detail view with loading and error handling |
| [`71e6230`](https://github.com/AlejandroRH2002/PsicoGestion/commit/71e62301f21bcba34f4b35f57925802e541892af) | Juan Daniel Kao Pech | 2026-10-01 | feat: implement therapist management features including registration, listing, and status updates |
| [`2975f0d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/2975f0dfb84a7f2c744e66ea7ec9f7e8d6b6ea79) | Juan Daniel Kao Pech | 2026-10-01 | feat: implement therapist management features |
| [`2193a03`](https://github.com/AlejandroRH2002/PsicoGestion/commit/2193a036362a9bd202b9b9783ab9fb3641426002) | Alexandercp7 | 2026-09-30 | feat: implementar modulo de registro de  terapeutas con api, validaciones y vista de registro |
| [`ebdd65d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ebdd65d23eec2db00808c1f48e2e4ef3cd0a443c) | Alexandercp7 | 2026-09-30 | feat: agregar migraciones de base de datos para terapeutas y pacientes |
| [`495a3e2`](https://github.com/AlejandroRH2002/PsicoGestion/commit/495a3e2173db56f83c0af2e3262a90d1c942f031) | Juan Daniel Kao Pech | 2026-09-30 | chore: remove VSCode settings file |
| [`c643b5e`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c643b5e42a52cc655d8e1f5c8aebf6a4553f1df4) | Juan Daniel Kao Pech | 2026-09-30 | feat: add environment setup for unit tests with mock database and email domains |
| [`da34586`](https://github.com/AlejandroRH2002/PsicoGestion/commit/da345861a3cc59e46e278f6b98618821a14b9d12) | Juan Daniel Kao Pech | 2026-09-30 | feat: implement therapist registration functionality with image upload and validation |
| [`da83e53`](https://github.com/AlejandroRH2002/PsicoGestion/commit/da83e534b06f829b371141312eab5c37a82d73f1) | Juan Daniel Kao Pech | 2026-09-30 | feat: add logo and implement new components for therapist registration |
| [`5400ed3`](https://github.com/AlejandroRH2002/PsicoGestion/commit/5400ed3be4143e18859b69b42258b69c86fa4778) | Juan Daniel Kao Pech | 2026-09-23 | feat: add password recovery functionality with email verification and reset process |
| [`5e41c8e`](https://github.com/AlejandroRH2002/PsicoGestion/commit/5e41c8e738434d1428ad92a23be6faea81c58715) | Juan Daniel Kao Pech | 2026-09-23 | feat: implement password recovery flow with email verification and new password setup |
| [`ac54984`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ac549842b9f598ba9e66b7ba93c54e9176ea6aa3) | Alexandercp7 | 2026-09-11 | feat: agregar pantalla de recuperación |
| [`c978861`](https://github.com/AlejandroRH2002/PsicoGestion/commit/c97886170f1a52021aa630d6b10b02ebe1839e3c) | Juan Daniel Kao Pech | 2026-09-22 | feat: initialize backend with authentication and migration setup |
| [`309fa64`](https://github.com/AlejandroRH2002/PsicoGestion/commit/309fa641b8f002d583f56b21afd3e37651594c66) | Juan Daniel Kao Pech | 2026-09-22 | feat: :construction_worker: add docker-compose configuration for PostgreSQL service |
| [`ce1da55`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ce1da557b7b24f8c0b39bfc595e5c96853bbe0c1) | Juan Daniel Kao Pech | 2026-09-22 | build: :arrow_up: add .env.example file for frontend |
| [`be4f6a6`](https://github.com/AlejandroRH2002/PsicoGestion/commit/be4f6a6ba3a44b928891174b99c55387e0c5ba09) | Juan Daniel Kao Pech | 2026-09-22 | style: :lipstick: update login/registration pages for PsicoGestión branding |
| [`dad4c93`](https://github.com/AlejandroRH2002/PsicoGestion/commit/dad4c93f8943e2208b9a0439272e81276182931a) | Juan Daniel Kao Pech | 2026-09-21 | Add database schema for PsicoGestion |
| [`2577a34`](https://github.com/AlejandroRH2002/PsicoGestion/commit/2577a34f3366d08a39f510ac374a61434e5ce216) | Alexandercp7 | 2026-09-11 | feat: agregar pantalla de recuperación |
| [`ec0d79b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/ec0d79b5db765ff6a88f83cd17c009bfc1e40374) | Tyrone Johnson | 2026-09-11 | feature: agregar páginas de login y registro de usuarios |
| [`b2e07cf`](https://github.com/AlejandroRH2002/PsicoGestion/commit/b2e07cf3d4b67800441fa4a7eadd3cf410777f37) | Emiliano | 2026-09-09 | docs(db): agrega diseño y documentación de la entidad secretaria |
| [`3a4776d`](https://github.com/AlejandroRH2002/PsicoGestion/commit/3a4776d8b3e88ac22fa76d3b189a725945134735) | AlejandroRH2002 | 2026-09-01 | docs: actualizar README y estructura del repositorio según ACS |
| [`00e8385`](https://github.com/AlejandroRH2002/PsicoGestion/commit/00e838562cd1f6c572874e091256fbd527f9a531) | AlejandroRH2002 | 2026-09-01 | docs: actualización de la descripcion del proyecto |
| [`6c27514`](https://github.com/AlejandroRH2002/PsicoGestion/commit/6c275142e86b8e89015145cecb3e05987889341a) | AlejandroRH2002 | 2026-08-28 | docs: agregar guia de gestion de configuracion con GitHub |
| [`706f60b`](https://github.com/AlejandroRH2002/PsicoGestion/commit/706f60b2f237d506405929907d081a63a325efe4) | AlejandroRH2002 | 2026-08-20 | Initial commit |

</details>

### C4 — Integraciones a `main` sin PR

Merges en `main` que no provienen de un Pull Request (además de los commits directos de C1):

_Sin elementos._

### C5 — Revisión y aprobación de los PR

| PR | Rama | Autor | Fusionado por | Fecha de fusión | Reviews | Aprobado por otro |
|---|---|---|---|---|---|---|
| [#3](https://github.com/AlejandroRH2002/PsicoGestion/pull/3) | feature/registro-usuarios | DanielKao72 | AlejandroRH2002 | 2026-09-22 | ninguno | no |
| [#4](https://github.com/AlejandroRH2002/PsicoGestion/pull/4) | feature/base-de-datos | DanielKao72 | AlejandroRH2002 | 2026-09-22 | ninguno | no |
| [#5](https://github.com/AlejandroRH2002/PsicoGestion/pull/5) | feature/recuperar-contraseña | DanielKao72 | AlejandroRH2002 | 2026-09-24 | ninguno | no |
| [#6](https://github.com/AlejandroRH2002/PsicoGestion/pull/6) | feature/migraciones-pacientes-terapeutas | Alexandercp7 | VictorHugoRok | 2026-10-02 | ninguno | no |
| [#7](https://github.com/AlejandroRH2002/PsicoGestion/pull/7) | feature/registro-terapeutas | DanielKao72 | DanielKao72 | 2026-10-02 | ninguno | no |
| [#8](https://github.com/AlejandroRH2002/PsicoGestion/pull/8) | feature/editar-terapeutas | DanielKao72 | DanielKao72 | 2026-10-02 | ninguno | no |
| [#12](https://github.com/AlejandroRH2002/PsicoGestion/pull/12) | feature/creacion-pacientes | Alexandercp7 | VanillaICe-jpg | 2026-10-02 | ninguno | no |
| [#13](https://github.com/AlejandroRH2002/PsicoGestion/pull/13) | feature/editar-pacientes | Alexandercp7 | VanillaICe-jpg | 2026-10-05 | ninguno | no |
| [#14](https://github.com/AlejandroRH2002/PsicoGestion/pull/14) | feature/PG-REQ-001-busqueda-pacientes-curp | EmilianoArceo1 | VanillaICe-jpg | 2026-10-07 | ninguno | no |
| [#15](https://github.com/AlejandroRH2002/PsicoGestion/pull/15) | feature/perfil-baja-pacientes | DanielKao72 | DanielKao72 | 2026-10-13 | ninguno | no |
| [#16](https://github.com/AlejandroRH2002/PsicoGestion/pull/16) | feature/registro-disponibilidad-salas | EmilianoArceo1 | VictorHugoRok | 2026-10-19 | ninguno | no |
| [#17](https://github.com/AlejandroRH2002/PsicoGestion/pull/17) | feature/gestion-citas-v2 | DanielKao72 | VictorHugoRok | 2026-10-19 | ninguno | no |
| [#18](https://github.com/AlejandroRH2002/PsicoGestion/pull/18) | feature/agenda-inicio | DanielKao72 | VictorHugoRok | 2026-10-19 | ninguno | no |
| [#19](https://github.com/AlejandroRH2002/PsicoGestion/pull/19) | fix/observaciones-fca-02 | DanielKao72 | VictorHugoRok | 2026-10-19 | ninguno | no |

PR fusionados por su propio autor: #7, #8, #15.

### C6 — Descripción de los PR según la plantilla (README §11)

| PR | Estado | Título | Secciones faltantes |
|---|---|---|---|
| [#1](https://github.com/AlejandroRH2002/PsicoGestion/pull/1) | CLOSED | Sync: Incluir frontend a main | descripción, cambios, módulos, pruebas, requerimiento |
| [#2](https://github.com/AlejandroRH2002/PsicoGestion/pull/2) | CLOSED | Feature/recuperar contraseña | módulos, requerimiento |
| [#3](https://github.com/AlejandroRH2002/PsicoGestion/pull/3) | MERGED | Feature/registro usuarios | descripción vacía |
| [#4](https://github.com/AlejandroRH2002/PsicoGestion/pull/4) | MERGED | Feature/base de datos | descripción vacía |
| [#5](https://github.com/AlejandroRH2002/PsicoGestion/pull/5) | MERGED | Feature/recuperar contraseña | descripción vacía |
| [#6](https://github.com/AlejandroRH2002/PsicoGestion/pull/6) | MERGED | feat: agregar migraciones de base de datos para terapeutas y pacientes | módulos |
| [#7](https://github.com/AlejandroRH2002/PsicoGestion/pull/7) | MERGED | Feature/registro terapeutas | descripción |
| [#8](https://github.com/AlejandroRH2002/PsicoGestion/pull/8) | MERGED | Feature/editar terapeutas | descripción, módulos |
| [#10](https://github.com/AlejandroRH2002/PsicoGestion/pull/10) | CLOSED | Feature/editar pacientes | descripción vacía |
| [#12](https://github.com/AlejandroRH2002/PsicoGestion/pull/12) | MERGED | Feature/creacion pacientes | ✔ completa |
| [#13](https://github.com/AlejandroRH2002/PsicoGestion/pull/13) | MERGED | Feature/editar pacientes | módulos, requerimiento |
| [#14](https://github.com/AlejandroRH2002/PsicoGestion/pull/14) | MERGED | [PG-REQ-001] Búsqueda de pacientes y validación de CURP | descripción, cambios, módulos |
| [#15](https://github.com/AlejandroRH2002/PsicoGestion/pull/15) | MERGED | fix(pacientes): perfil, baja lógica, adjuntos y búsqueda por CURP (RF 3.1-3.3) | ✔ completa |
| [#16](https://github.com/AlejandroRH2002/PsicoGestion/pull/16) | MERGED | feat(salas): implementar registro y consulta de disponibilidad | cambios, módulos |
| [#17](https://github.com/AlejandroRH2002/PsicoGestion/pull/17) | MERGED | feat(citas): agendar, visualizar, modificar y cancelar citas (RF 5.1–5.4) | ✔ completa |
| [#18](https://github.com/AlejandroRH2002/PsicoGestion/pull/18) | MERGED | feat(agenda): pantalla de inicio con agenda diaria, semanal, mensual e impresión (RF 6.1–6.2, 7.1–7.2) | ✔ completa |
| [#19](https://github.com/AlejandroRH2002/PsicoGestion/pull/19) | MERGED | fix: corregir observaciones FCA-02 de salas, citas y agenda (RF 4.2, RF 5.1.14, RF 5.4.2) | ✔ completa |
| [#20](https://github.com/AlejandroRH2002/PsicoGestion/pull/20) | CLOSED | agregar manual de usuario PsicoGestión v0.2.0 | descripción vacía |
| [#21](https://github.com/AlejandroRH2002/PsicoGestion/pull/21) | OPEN | docs: actualizar manual técnico v0.2.0 | cambios, módulos, pruebas, requerimiento |

PR con base distinta de `main`: #8 → `feature/registro-terapeutas`.

PR no fusionados (abiertos o cerrados): #1 (closed), #2 (closed), #10 (closed), #20 (closed), #21 (open).

### C7 — Una tarea por rama y limpieza de ramas

| Rama remota | Último commit | Autor | Fusionada en `main` | Observación |
|---|---|---|---|---|
| `docs` | 2026-08-20 | AlejandroRH2002 | sí (no se borró) |  |
| `feature/PG-REQ-001-busqueda-pacientes-curp` | 2026-10-05 | Emiliano | sí (no se borró) |  |
| `feature/agenda-citas` | 2026-10-09 | Tyrone Johnson | no |  |
| `feature/agenda-inicio` | 2026-10-14 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/base-de-datos` | 2026-09-21 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/corregir-errores-auditoria` | 2026-10-16 | Tyrone J | no |  |
| `feature/creacion-pacientes` | 2026-10-02 | Israel Cruz Morales | sí (no se borró) |  |
| `feature/editar-pacientes` | 2026-10-05 | Alexandercp7 | sí (no se borró) |  |
| `feature/editar-terapeutas` | 2026-10-01 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/gestion-citas` | 2026-10-09 | Alexandercp7 | no |  |
| `feature/gestion-citas-v2` | 2026-10-13 | Juan Daniel Kao Pech | sí (no se borró) | sufijo de versión: posible tarea repetida |
| `feature/gestion-terapeutas` | 2026-09-30 | Alexandercp7 | sí (no se borró) |  |
| `feature/manual-tecnico-v0.2.0` | 2026-10-28 | Emiliano Antonio Arceo Márquez | no |  |
| `feature/perfil-baja-pacientes` | 2026-10-07 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/recuperar-contraseña` | 2026-09-23 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/registro-disponibilidad-salas` | 2026-10-13 | Emiliano | sí (no se borró) |  |
| `feature/registro-terapeutas` | 2026-09-30 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/registro-usuarios` | 2026-09-22 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `feature/validacion-cedula-profesional` | 2026-10-01 | Juan Daniel Kao Pech | sí (no se borró) |  |
| `fix/validaciones-pacientes` | 2026-10-06 | AlejandroRH2002 | no |  |
| `manual` | 2026-10-23 | Emiliano Antonio Arceo Márquez | no |  |

Ramas reutilizadas en más de un PR:

- `feature/recuperar-contraseña`: #2, #5
- `feature/editar-pacientes`: #10, #13

### C8 — Protección de `main`

Resultado: **no verificable con los permisos actuales (gh: Not Found (HTTP 404)). Capturar Settings → Branches.**

Evidencia indirecta: 5 commit(s) directo(s) en `main` (C1).

## 4. Participación por integrante

**Identidades de git** (agrupadas por nombre; varios correos para una misma persona son una observación menor):

| Nombre | Commits | Merges | Correos |
|---|---|---|---|
| Juan Daniel Kao Pech | 34 | 3 | a19201340@alumnos.uady.mx, 142283435+danielkao72@users.noreply.github.com |
| AlejandroRH2002 | 12 | 3 | alejandro.ramayo2015@gmail.com, 125323622+alejandrorh2002@users.noreply.github.com |
| Alexandercp7 | 11 | 2 | a22216350@alumnos.uady.mx, a22216350@alumnos.uady.com |
| Emiliano | 6 | 0 | a19204003@alumnos.uady.mx |
| Emiliano Antonio Arceo Márquez | 3 | 0 | 74621218+emilianoarceo1@users.noreply.github.com |
| Tyrone Johnson | 2 | 0 | tyronejjd24@gmail.com |
| Tyrone J | 1 | 0 | tyronejjd24@gmail.com |
| VictorHugoRok | 0 | 3 | 142284911+victorhugorok@users.noreply.github.com |
| Israel Cruz Morales | 0 | 4 | isracruzm@hotmail.com |

**Cuentas de GitHub**:

| Usuario | PR abiertos | PR fusionados | PR que fusionó | Reviews a otros | Aprobaciones |
|---|---|---|---|---|---|
| DanielKao72 | 9 | 9 | 3 | 0 | 0 |
| Alexandercp7 | 4 | 3 | 0 | 0 | 0 |
| EmilianoArceo1 | 4 | 2 | 0 | 0 | 0 |
| TyJhnsnD | 1 | 0 | 0 | 0 | 0 |
| AlejandroRH2002 | 1 | 0 | 3 | 0 | 0 |
| VictorHugoRok | 0 | 0 | 5 | 0 | 0 |
| VanillaICe-jpg | 0 | 0 | 3 | 0 | 0 |

## 5. Buenas prácticas observadas

<!-- COMPLETAR: qué se hizo bien (p. ej. adopción del formato de commits, uso de PR, documentación, pruebas). -->

## 6. No conformidades y severidad

| ID | Criterio | Descripción | Evidencia | Severidad | Justificación |
|---|---|---|---|---|---|
| NC-01 |  | <!-- COMPLETAR --> |  | Alta / Media / Baja |  |

## 7. Recomendaciones

<!-- COMPLETAR: p. ej. activar protección de `main` con aprobación obligatoria, añadir `.github/pull_request_template.md`, workflow de CI que valide nombre de rama, formato de commits y plantilla de PR, borrar ramas fusionadas. -->

## 8. Conclusión

<!-- COMPLETAR -->
