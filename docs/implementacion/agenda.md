# Pantalla de inicio: Agenda

Implementa RF 6.1 (vista de agenda por día, semana o mes), RF 6.2 (impresión de la agenda) y RF 7.1–7.2 (pantalla de inicio con la agenda y navegación a los módulos). Es una vista de solo lectura sobre el módulo de citas (`docs/implementacion/citas.md`).

## Decisiones

- **Qué citas se muestran:** solo las `Pendiente` y las `Vencida`, es decir, lo que ocupará u ocupó la clínica. Las vencidas aparecen atenuadas. Las `Cancelada` no se muestran porque su horario quedó libre.
- **Posición de cada cita:** una cita aparece completa en el bloque en el que inicia y muestra su duración. En los bloques siguientes que sigue ocupando (p. ej. una cita de 90 min) se muestra una fila atenuada «Continúa: paciente · sala (hasta hh:mm)», en lugar de «Espacio disponible» (`citasEnCurso` en `utils/agenda.ts`). En la vista semanal, esas horas muestran un chip «↳ paciente». Si varias citas inician a la misma hora (en salas distintas), se apilan.
- **Jornada:** 07:00–17:00 en bloques de 30 min, con las mismas constantes que el módulo de citas. La vista semanal agrupa por hora (07:00–16:00) y antepone `hh:30` a las citas que inician a la media hora.
- **Filtros:** terapeuta y sala. No vienen en el diseño, pero se agregaron por acuerdo con el usuario. También se aplican a la impresión, y la hoja los menciona.
- **Impresión:** se imprime la vista actual, en tamaño carta.
  - Día: vertical. Tabla HORA | PACIENTE | TERAPEUTA | SALA con 20 lapsos de 30 min (RF 6.2.2).
  - Semana y mes: horizontal, con layouts propios.

  La vista previa permite cambiar la fecha sin alterar la pantalla. Para imprimir, la hoja se clona en `#area-impresion` (hijo directo de `<body>`), se inyecta un `@page` con la orientación y se llama a `window.print()`. El bloque `@media print` de `global.css` oculta el resto de la aplicación. El PDF se obtiene desde el diálogo de impresión del navegador.
- **Actualización:** la agenda se recarga cuando la pestaña vuelve a estar visible, así que los cambios hechos en `/citas` aparecen sin recargar a mano.
- **Navegación:** al iniciar sesión se entra a `/inicio`, que también es la opción "Inicio" del sidebar. Clic en una cita abre su edición; clic en un día del mes abre la vista de día de esa fecha. El estado (vista, fecha y filtros) se guarda en la URL.

## API

`GET /agenda?vista=dia|semana|mes&fecha=AAAA-MM-DD&terapeutaId&salaId` (requiere sesión).

- Valores por defecto: `vista=semana` y `fecha=hoy`.
- Rango que cubre cada vista:
  - `dia`: solo la fecha.
  - `semana`: de lunes a viernes de la semana que contiene la fecha.
  - `mes`: del primer al último día del mes.
- Respuesta: `{ vista, fecha, desde, hasta, jornada: { inicio, fin, minutosBloque }, citas: [cita] }`. `cita` tiene la misma forma que en `/citas`, y las citas vienen ordenadas por fecha, hora y sala.
- Errores: `400 { errors }` si la vista o la fecha son inválidas, y `401` sin sesión.

## Código

- Backend:
  - `validators/agenda.validators.js` (`validateAgenda`, `rangoAgenda`).
  - `services/cita.service.js#agendaEntre`.
  - `controllers/agenda.controller.js` y `routes/agenda.routes.js`.
- Frontend:
  - `pages/inicio.astro`.
  - `utils/agenda.ts`: API, fechas, `renderDia`, `renderSemana`, `renderMes` e `iniciarAgenda`.
  - `utils/agenda-impresion.ts`.
  - `components/agenda/ModalImpresion.astro`.
  - Reglas `@media print` en `styles/global.css`.

## Trazabilidad

| Requisito | Implementación | Pruebas |
|---|---|---|
| RF 6.1.1–6.1.2 | `GET /agenda`, `/inicio` (día/semana/mes) | `agenda.validators.test.js`, `integracion/agenda.test.js` |
| RF 6.2.1–6.2.4 | `ModalImpresion` + `agenda-impresion.ts` | Verificación manual (vista previa y `@page`) |
| RF 7.1.1 | `/inicio` como pantalla de entrada tras el login | Verificación manual |
| RF 7.2.1–7.2.6 | Sidebar con Inicio, Pacientes, Terapeutas, Salas, Citas y Cerrar sesión | Verificación manual |
