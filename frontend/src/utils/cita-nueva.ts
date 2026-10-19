import {
  crearCita,
  fechaLarga,
  horario,
  iniciarRejilla,
  iniciarSelector,
  llenarSalas,
  mostrarErrorCampo,
  opcionesPacientes,
  opcionesTerapeutas,
  textoNotificacion,
  validar,
  type Cita,
  type DatosCita,
  type FieldError,
  type Notificacion,
} from './cita';

const SUBTITULOS = [
  'Complete el paso 1 de selección para programar una sesión.',
  'Paso 2: Busque y seleccione un espacio disponible en la agenda.',
  'Paso 3: Verifique que todos los datos sean correctos antes de registrar.',
];

/** RF 5.1.1–5.1.13: asistente de tres pasos para agendar una cita (pages/citas/nueva.astro). */
export function iniciarNuevaCita() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const secciones = [$('paso-1'), $('paso-2'), $('paso-3'), $('exito')];
  const aviso = $('aviso');
  const paciente = iniciarSelector($('paciente'), opcionesPacientes);
  const terapeuta = iniciarSelector($('terapeuta'), opcionesTerapeutas);
  const rejilla = iniciarRejilla($('rejilla'));
  const duracion = $<HTMLSelectElement>('duracion');
  const sala = $<HTMLSelectElement>('sala');
  const siguiente2 = $<HTMLButtonElement>('paso-2-siguiente');
  const confirmar = $<HTMLButtonElement>('confirmar');
  let paso = 1;

  function mostrarAviso(texto: string | null) {
    aviso.textContent = texto ?? '';
    aviso.classList.toggle('hidden', !texto);
  }

  function irA(n: number) {
    paso = n;
    secciones.forEach((s, i) => { s.hidden = i !== n - 1; });
    $('encabezado').hidden = n === 4;
    if (n <= 3) $('subtitulo').textContent = SUBTITULOS[n - 1];
    document.querySelectorAll<HTMLElement>('#stepper [data-paso]').forEach((li) => {
      const i = Number(li.dataset.paso);
      const circulo = li.querySelector<HTMLElement>('[data-circulo]')!;
      const hecho = i < n;
      const actual = i === n;
      circulo.textContent = hecho ? '✓' : String(i);
      circulo.className = `flex items-center justify-center size-6 rounded-full text-[11px] font-semibold ${
        hecho ? 'bg-[#0D9488] text-white' : actual ? 'border border-[#0D9488] bg-[#CCFBF1] text-[#115E59]' : 'text-[#94A3B8]'
      }`;
      li.querySelector<HTMLElement>('[data-nombre]')!.className = `text-[13px] font-semibold ${hecho || actual ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`;
      if (actual) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      const linea = li.querySelector<HTMLElement>('[data-linea]');
      if (linea) linea.className = `h-0.5 flex-1 rounded-full ${hecho ? 'bg-[#0D9488]' : 'bg-[#E2E8F0]'}`;
    });
    mostrarAviso(null);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }

  function datos(): DatosCita {
    const sel = rejilla.seleccion();
    return {
      pacienteId: paciente.valor()?.id ?? null,
      terapeutaId: terapeuta.valor()?.id ?? null,
      salaId: sala.disabled ? null : Number(sala.value) || null,
      fecha: sel?.fecha ?? '',
      horaInicio: sel?.slot.horaInicio ?? '',
      duracion: Number(duracion.value),
    };
  }

  function mostrarErrores(errores: FieldError[]) {
    for (const campo of ['duracion', 'salaId', 'horaInicio']) mostrarErrorCampo(campo, null);
    paciente.error(null);
    terapeuta.error(null);
    for (const e of errores) {
      if (e.field === 'pacienteId') paciente.error(e.message);
      else if (e.field === 'terapeutaId') terapeuta.error(e.message);
      else if (e.field === 'fecha') mostrarErrorCampo('horaInicio', e.message);
      else mostrarErrorCampo(e.field, e.message);
    }
  }

  // Paso 1 → 2
  $('paso-1-siguiente').addEventListener('click', () => {
    const errores = validar(datos()).filter((e) => ['pacienteId', 'terapeutaId'].includes(e.field));
    mostrarErrores(errores);
    if (errores.length) return;
    rejilla.configurar({ terapeutaId: terapeuta.valor()!.id, duracion: Number(duracion.value) });
    irA(2);
    rejilla.cargar();
  });

  // Paso 2: selección de horario y sala
  rejilla.alSeleccionar((sel) => {
    $('sel-fecha').textContent = sel ? fechaLarga(sel.fecha) : 'Selecciona un horario';
    $('sel-hora').textContent = sel ? `${sel.slot.horaInicio} - ${sel.slot.horaFin}` : '—';
    if (sel) llenarSalas(sala, sel.slot.salasLibres);
    else { sala.replaceChildren(new Option('Selecciona un horario')); sala.disabled = true; }
    siguiente2.disabled = !sel;
    mostrarErrorCampo('horaInicio', null);
  });
  duracion.addEventListener('change', () => {
    rejilla.configurar({ terapeutaId: terapeuta.valor()?.id ?? null, duracion: Number(duracion.value) });
    rejilla.cargar();
  });
  $('paso-2-anterior').addEventListener('click', () => irA(1));
  siguiente2.addEventListener('click', () => {
    const errores = validar(datos());
    mostrarErrores(errores);
    if (errores.length) return;
    const d = datos();
    $('conf-paciente').textContent = paciente.valor()!.nombre;
    $('conf-terapeuta').textContent = terapeuta.valor()!.nombre;
    $('conf-sala').textContent = sala.selectedOptions[0].text;
    $('conf-fecha').textContent = fechaLarga(d.fecha);
    $('conf-horario').textContent = horario(
      { horaInicio: d.horaInicio, horaFin: rejilla.seleccion()!.slot.horaFin, duracion: d.duracion },
      true,
    );
    irA(3);
  });

  // Paso 3: confirmación y registro
  $('paso-3-anterior').addEventListener('click', () => irA(2));
  confirmar.addEventListener('click', async () => {
    confirmar.disabled = true;
    const textoOriginal = confirmar.innerHTML;
    confirmar.textContent = 'Registrando…';
    try {
      const resultado = await crearCita(datos());
      if (resultado.cita) {
        mostrarExito(resultado.cita, resultado.notificacion);
        return;
      }
      // 409 por un cruce que ocurrió mientras se confirmaba: se vuelve al paso 2 con la rejilla actualizada,
      // conservando paciente y terapeuta (RNF 5.1.5).
      const errores = resultado.errores ?? [];
      const enPaso1 = errores.some((e) => ['pacienteId', 'terapeutaId'].includes(e.field) && !/horario/.test(e.message));
      irA(enPaso1 ? 1 : 2);
      mostrarAviso(errores[0]?.message ?? 'No se pudo registrar la cita.');
      mostrarErrores(errores);
      if (!enPaso1) await rejilla.cargar();
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'No se pudo registrar la cita. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      confirmar.disabled = false;
      confirmar.innerHTML = textoOriginal;
    }
  });

  function mostrarExito(cita: Cita, notificacion?: Notificacion) {
    const texto = textoNotificacion(notificacion);
    const avisoNotificacion = $('exito-notificacion');
    avisoNotificacion.textContent = texto ?? '';
    avisoNotificacion.hidden = !texto;
    avisoNotificacion.className = `text-sm ${notificacion?.enviada ? 'text-[#006847]' : 'text-[#B45309]'}`;
    $('exito-folio').textContent = cita.folio;
    $('exito-paciente').textContent = cita.paciente.nombre;
    $('exito-terapeuta').textContent = cita.terapeuta.nombre;
    $('exito-sala').textContent = cita.sala.nombre;
    $('exito-fecha').textContent = `${fechaLarga(cita.fecha)}, ${horario(cita)}`;
    irA(4);
  }

  $('agendar-otra').addEventListener('click', () => {
    paciente.fijar(null);
    terapeuta.fijar(null);
    duracion.value = '60';
    rejilla.configurar({ terapeutaId: null, duracion: 60 });
    rejilla.fijarSeleccion('', '');
    irA(1);
  });

  irA(paso);
}
