import {
  actualizarCita,
  fechaLarga,
  horaFinDe,
  horario,
  iniciarRejilla,
  iniciarSelector,
  listarSalas,
  mostrarErrorCampo,
  obtenerCita,
  opcionesPacientes,
  opcionesTerapeutas,
  pintarEstado,
  validar,
  type DatosCita,
  type EstadoCita,
  type FieldError,
} from './cita';

/** RF 5.3.1–5.3.6: modificación de una cita (pages/citas/editar.astro). */
export async function iniciarEditarCita() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = $<HTMLFormElement>('form-cita');
  const aviso = $('aviso');
  const sala = $<HTMLSelectElement>('sala');
  const estado = $<HTMLSelectElement>('estado');
  const guardar = $<HTMLButtonElement>('guardar');
  const dialogoHorario = $<HTMLDialogElement>('dialogo-horario');
  const dialogoConfirmar = $<HTMLDialogElement>('dialogo-confirmar');
  const duracion = $<HTMLSelectElement>('duracion');
  const aplicar = $<HTMLButtonElement>('horario-aplicar');

  function mostrarAviso(texto: string | null) {
    aviso.textContent = texto ?? '';
    aviso.classList.toggle('hidden', !texto);
  }

  let cita;
  try {
    cita = await obtenerCita(new URLSearchParams(location.search).get('id'));
  } catch (err) {
    $('cargando').hidden = true;
    mostrarAviso(err instanceof Error ? err.message : 'No se pudo cargar la cita.');
    return;
  }
  $('cargando').hidden = true;
  if (!cita) {
    mostrarAviso('La cita que buscas no existe.');
    return;
  }
  const id = cita.id;

  const paciente = iniciarSelector($('paciente'), opcionesPacientes);
  const terapeuta = iniciarSelector($('terapeuta'), opcionesTerapeutas);
  const rejilla = iniciarRejilla($('rejilla'));
  const horarioActual = { fecha: cita.fecha, horaInicio: cita.horaInicio, duracion: cita.duracion };

  $('folio').textContent = cita.folio;
  pintarEstado($('estado-actual'), cita.estado, 'Actualmente ');
  paciente.fijar(cita.paciente);
  terapeuta.fijar(cita.terapeuta);
  estado.value = cita.estado;
  try {
    const salas = await listarSalas();
    sala.replaceChildren(...salas.map((s) => new Option(s.nombre, String(s.id))));
  } catch {
    sala.replaceChildren(new Option(cita.sala.nombre, String(cita.sala.id)));
  }
  sala.value = String(cita.sala.id);

  function pintarHorario() {
    const { fecha, horaInicio, duracion: d } = horarioActual;
    $('horario-texto').textContent = `${fechaLarga(fecha)}, ${horario({ horaInicio, horaFin: horaFinDe(horaInicio, d), duracion: d })}`;
  }
  pintarHorario();
  form.hidden = false;

  // Diálogo de horario
  $('modificar-horario').addEventListener('click', async () => {
    const t = terapeuta.valor();
    if (!t) { terapeuta.error('Selecciona un terapeuta.'); return; }
    duracion.value = String(horarioActual.duracion);
    rejilla.configurar({ terapeutaId: t.id, duracion: horarioActual.duracion, semana: horarioActual.fecha, excluir: id });
    rejilla.fijarSeleccion(horarioActual.fecha, horarioActual.horaInicio);
    dialogoHorario.showModal();
    await rejilla.cargar();
  });
  rejilla.alSeleccionar((sel) => {
    aplicar.disabled = !sel;
    $('horario-seleccionado').textContent = sel ? `${fechaLarga(sel.fecha)}, ${sel.slot.horaInicio} - ${sel.slot.horaFin}` : 'Selecciona un horario disponible.';
  });
  duracion.addEventListener('change', () => {
    rejilla.configurar({ terapeutaId: terapeuta.valor()?.id ?? null, duracion: Number(duracion.value) });
    rejilla.cargar();
  });
  $('horario-cerrar').addEventListener('click', () => dialogoHorario.close());
  aplicar.addEventListener('click', () => {
    const sel = rejilla.seleccion();
    if (!sel) return;
    Object.assign(horarioActual, { fecha: sel.fecha, horaInicio: sel.slot.horaInicio, duracion: Number(duracion.value) });
    // Si la sala elegida no queda libre en el nuevo horario, se propone la primera disponible.
    if (!sel.slot.salasLibres.some((s) => String(s.id) === sala.value)) sala.value = String(sel.slot.salasLibres[0].id);
    mostrarErrorCampo('horaInicio', null);
    mostrarErrorCampo('salaId', null);
    pintarHorario();
    dialogoHorario.close();
  });

  function datos(): DatosCita {
    return {
      pacienteId: paciente.valor()?.id ?? null,
      terapeutaId: terapeuta.valor()?.id ?? null,
      salaId: Number(sala.value) || null,
      fecha: horarioActual.fecha,
      horaInicio: horarioActual.horaInicio,
      duracion: horarioActual.duracion,
      estado: estado.value as EstadoCita,
    };
  }

  function mostrarErrores(errores: FieldError[]) {
    for (const campo of ['salaId', 'horaInicio', 'duracion', 'estado']) mostrarErrorCampo(campo, null);
    paciente.error(null);
    terapeuta.error(null);
    for (const e of errores) {
      if (e.field === 'pacienteId') paciente.error(e.message);
      else if (e.field === 'terapeutaId') terapeuta.error(e.message);
      else if (e.field === 'fecha') mostrarErrorCampo('horaInicio', e.message);
      else mostrarErrorCampo(e.field, e.message);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    mostrarAviso(null);
    const errores = validar(datos(), { edicion: true });
    mostrarErrores(errores);
    if (errores.length) return;
    $('confirmar-detalle').textContent = `${paciente.valor()!.nombre} con ${terapeuta.valor()!.nombre}, `
      + `${sala.selectedOptions[0].text}, ${$('horario-texto').textContent}. Estatus: ${estado.value}.`;
    dialogoConfirmar.showModal();
  });

  dialogoConfirmar.addEventListener('close', async () => {
    if (dialogoConfirmar.returnValue !== 'confirmar') return;
    guardar.disabled = true;
    try {
      const resultado = await actualizarCita(id, datos());
      if (resultado.cita) {
        location.assign('/citas?actualizada=1');
        return;
      }
      const errores = resultado.errores ?? [];
      mostrarErrores(errores);
      mostrarAviso(errores[0]?.message ?? 'No se pudieron guardar los cambios.');
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'No se pudieron guardar los cambios. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      guardar.disabled = false;
    }
  });
}
