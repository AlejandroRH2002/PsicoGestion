import { listarTerapeutas } from './terapeuta';
import {
  cancelarCita,
  fechaCorta,
  hoyLocal,
  listarCitas,
  listarSalas,
  obtenerCitaPorFolio,
  pintarEstado,
  textoNotificacion,
  type Cita,
  type EstadoCita,
  type FiltrosCitas,
  type Periodo,
} from './cita';

/** RF 5.2.1–5.2.3 y RF 5.4: directorio de citas con pestañas, filtros, paginación y cancelación. */
export function iniciarDirectorioCitas() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const filas = $('filas');
  const plantilla = $<HTMLTemplateElement>('fila-template');
  const estadoLista = $('estado-lista');
  const aviso = $('aviso');
  const q = $<HTMLInputElement>('q');
  const sala = $<HTMLSelectElement>('sala');
  const terapeuta = $<HTMLSelectElement>('terapeuta');
  const fecha = $<HTMLInputElement>('fecha');
  const dialogo = $<HTMLDialogElement>('confirmar-cancelacion');

  const url = new URLSearchParams(location.search);
  const filtros: FiltrosCitas = {
    q: url.get('q') ?? '',
    estado: (['Pendiente', 'Cancelada', 'Vencida'].includes(url.get('estado') ?? '') ? url.get('estado') : '') as EstadoCita | '',
    salaId: url.get('salaId') ?? '',
    terapeutaId: url.get('terapeutaId') ?? '',
    periodo: (['dia', 'semana', 'mes'].includes(url.get('periodo') ?? '') ? url.get('periodo') : '') as Periodo | '',
    fecha: url.get('fecha') || hoyLocal(),
    page: Math.max(1, Number(url.get('page')) || 1),
  };
  let consulta = 0;

  function mostrarAviso(texto: string, tipo: 'success' | 'error') {
    aviso.textContent = texto;
    aviso.className = `p-3 rounded-lg text-sm ${tipo === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`;
  }
  if (url.has('actualizada')) {
    const c = url.get('confirmacion');
    const notificacion = textoNotificacion(c === 'enviada' ? { enviada: true } : c ? { enviada: false, motivo: c } : undefined);
    mostrarAviso(['Cambios guardados correctamente.', notificacion].filter(Boolean).join(' '), 'success');
  }

  function sincronizarUrl() {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor && !(clave === 'page' && valor === 1) && !(clave === 'fecha' && (!filtros.periodo || valor === hoyLocal()))) {
        params.set(clave, String(valor));
      }
    }
    history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
  }

  function pintarControles() {
    q.value = filtros.q;
    document.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.estado === filtros.estado));
    });
    document.querySelectorAll<HTMLElement>('[data-periodo]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.periodo === filtros.periodo));
    });
    $('fecha-ref-label').hidden = !filtros.periodo;
    fecha.value = filtros.fecha;
  }

  function fila(cita: Cita) {
    const nodo = plantilla.content.cloneNode(true) as DocumentFragment;
    nodo.querySelector('[data-folio]')!.textContent = cita.folio;
    nodo.querySelector('[data-paciente]')!.textContent = cita.paciente.nombre;
    nodo.querySelector('[data-terapeuta]')!.textContent = cita.terapeuta.nombre;
    nodo.querySelector('[data-sala]')!.textContent = cita.sala.nombre;
    nodo.querySelector('[data-fecha]')!.textContent = `${fechaCorta(cita.fecha)}, ${cita.horaInicio}`;
    pintarEstado(nodo.querySelector<HTMLElement>('[data-estatus]')!, cita.estado);
    const editar = nodo.querySelector<HTMLAnchorElement>('[data-editar]')!;
    editar.href = `/citas/editar?id=${cita.id}`;
    editar.setAttribute('aria-label', `Modificar cita ${cita.folio}`);
    const cancelar = nodo.querySelector<HTMLButtonElement>('[data-cancelar]')!;
    cancelar.setAttribute('aria-label', `Cancelar cita ${cita.folio}`);
    cancelar.disabled = cita.estado !== 'Pendiente';
    cancelar.title = cita.estado === 'Pendiente' ? 'Cancelar cita' : 'Solo se pueden cancelar citas pendientes';
    cancelar.addEventListener('click', () => pedirCancelacion(cita));
    return nodo;
  }

  function boton(texto: string, pagina: number, { actual = false, deshabilitado = false } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.disabled = deshabilitado;
    if (actual) b.setAttribute('aria-current', 'page');
    b.className = `h-8 min-w-8 px-3 rounded-md border text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
      actual ? 'border-[#0D9488] bg-[#CCFBF1] text-[#115E59]' : 'border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'
    }`;
    b.addEventListener('click', () => { filtros.page = pagina; cargar(); });
    return b;
  }

  function pintarPaginacion(total: number, limit: number) {
    const paginas = Math.max(1, Math.ceil(total / limit));
    const desde = Math.max(1, Math.min(filtros.page - 2, paginas - 4));
    const numeros = Array.from({ length: Math.min(5, paginas) }, (_, i) => desde + i);
    $('paginacion').replaceChildren(
      boton('Anterior', filtros.page - 1, { deshabilitado: filtros.page <= 1 }),
      ...numeros.map((n) => boton(String(n), n, { actual: n === filtros.page })),
      boton('Siguiente', filtros.page + 1, { deshabilitado: filtros.page >= paginas }),
    );
  }

  async function cargar() {
    const id = ++consulta;
    sincronizarUrl();
    pintarControles();
    estadoLista.textContent = 'Cargando citas…';
    estadoLista.classList.remove('hidden');
    try {
      const r = await listarCitas(filtros);
      if (id !== consulta) return;
      for (const [clave, valor] of Object.entries(r.conteos)) {
        const el = document.querySelector<HTMLElement>(`[data-conteo="${clave}"]`);
        if (el) el.textContent = String(valor);
      }
      filas.replaceChildren(...r.citas.map(fila));
      estadoLista.textContent = r.total === 0 ? 'No hay citas que coincidan con los filtros.' : '';
      estadoLista.classList.toggle('hidden', r.citas.length > 0);
      if (r.total > 0 && r.citas.length === 0 && filtros.page > 1) {
        filtros.page = 1;
        cargar();
        return;
      }
      $('resumen').textContent = `Mostrando ${r.citas.length} de ${r.total} registros`;
      pintarPaginacion(r.total, r.limit);
    } catch (err) {
      if (id !== consulta) return;
      filas.replaceChildren();
      estadoLista.textContent = err instanceof Error ? err.message : 'No se pudo cargar la lista de citas.';
    }
  }

  let citaPorCancelar: Cita | null = null;
  function pedirCancelacion(cita: Cita) {
    citaPorCancelar = cita;
    $('cancelar-folio').textContent = cita.folio;
    $('cancelar-paciente').textContent = cita.paciente.nombre;
    dialogo.showModal();
  }
  dialogo.addEventListener('close', async () => {
    if (dialogo.returnValue !== 'confirmar' || !citaPorCancelar) return;
    const cita = citaPorCancelar;
    citaPorCancelar = null;
    try {
      await cancelarCita(cita.id);
      mostrarAviso(`La cita ${cita.folio} fue cancelada correctamente.`, 'success');
      await cargar();
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'No se pudo cancelar la cita.', 'error');
    }
  });

  // RF 5.4.2: cancelar a partir del folio; reutiliza el mismo diálogo de confirmación (RF 5.4.3–5.4.4).
  const folioForm = $<HTMLFormElement>('cancelar-folio-form');
  const folio = $<HTMLInputElement>('folio');
  const folioError = $('folio-error');
  function errorFolio(texto: string | null) {
    folioError.textContent = texto ?? '';
    folioError.classList.toggle('hidden', !texto);
    if (texto) folio.setAttribute('aria-invalid', 'true'); else folio.removeAttribute('aria-invalid');
  }
  folio.addEventListener('input', () => errorFolio(null));
  folioForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = folio.value.trim().toUpperCase();
    // Mismo formato y mensaje que backend/src/validators/cita.validators.js#parseFolio.
    if (!/^CIT-\d{4}-\d{5,9}$/.test(valor)) {
      errorFolio('Ingresa un folio válido con formato CIT-AAAA-NNNNN.');
      return;
    }
    const boton = folioForm.querySelector('button')!;
    boton.disabled = true;
    try {
      const cita = await obtenerCitaPorFolio(valor);
      if (!cita) errorFolio('No existe una cita con ese folio.');
      else if (cita.estado !== 'Pendiente') errorFolio(`La cita ${cita.folio} ya está ${cita.estado.toLowerCase()}.`);
      else {
        folio.value = '';
        pedirCancelacion(cita);
      }
    } catch (err) {
      errorFolio(err instanceof Error ? err.message : 'No se pudo buscar la cita.');
    } finally {
      boton.disabled = false;
    }
  });

  // Controles
  document.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
    filtros.estado = tab.dataset.estado as EstadoCita | '';
    filtros.page = 1;
    cargar();
  }));
  document.querySelectorAll<HTMLElement>('[data-periodo]').forEach((b) => b.addEventListener('click', () => {
    filtros.periodo = b.dataset.periodo as Periodo | '';
    filtros.page = 1;
    cargar();
  }));
  let temporizador: number | undefined;
  q.addEventListener('input', () => {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => { filtros.q = q.value.trim(); filtros.page = 1; cargar(); }, 300);
  });
  sala.addEventListener('change', () => { filtros.salaId = sala.value; filtros.page = 1; cargar(); });
  terapeuta.addEventListener('change', () => { filtros.terapeutaId = terapeuta.value; filtros.page = 1; cargar(); });
  fecha.addEventListener('change', () => { if (fecha.value) { filtros.fecha = fecha.value; filtros.page = 1; cargar(); } });

  async function cargarOpciones() {
    const [salas, terapeutas] = await Promise.all([
      listarSalas().catch(() => []),
      listarTerapeutas({ q: '', estado: 'todos', orden: 'nombre' }).catch(() => []),
    ]);
    sala.append(...salas.map((s) => new Option(s.nombre, String(s.id))));
    terapeuta.append(...terapeutas.map((t) => new Option(t.nombre, String(t.id))));
    sala.value = filtros.salaId;
    terapeuta.value = filtros.terapeutaId;
  }

  cargarOpciones();
  cargar();
}
