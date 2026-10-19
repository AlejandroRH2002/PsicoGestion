import { pedirApi as pedir } from './sesion';
import { buscarPacientes } from './paciente';
import { listarTerapeutas } from './terapeuta';
import { listarSalas, type Sala } from './sala';

// Rejilla de agenda: mantener sincronizado con backend/src/validators/cita.validators.js.
export const HORA_INICIO_JORNADA = '07:00';
export const HORA_FIN_JORNADA = '17:00';
export const MINUTOS_BLOQUE = 30;
export const DURACIONES = [30, 60, 90] as const;
export const DURACION_PREDETERMINADA = 60;
export const ESTADOS_CITA = ['Pendiente', 'Cancelada', 'Vencida'] as const;

export type EstadoCita = (typeof ESTADOS_CITA)[number];
export type Periodo = 'dia' | 'semana' | 'mes';

export interface Referencia { id: number; nombre: string }
export interface Cita {
  id: number;
  folio: string;
  estado: EstadoCita;
  paciente: Referencia;
  terapeuta: Referencia;
  sala: Referencia;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracion: number;
}
export interface FieldError { field: string; message: string }
export interface Slot {
  horaInicio: string;
  horaFin: string;
  estado: 'disponible' | 'ocupado' | 'pasado' | 'fuera';
  motivo: 'terapeuta' | 'salas' | 'pasado' | 'jornada' | null;
  salasLibres: Sala[];
}
export interface Semana { semana: { inicio: string; fin: string }; duracion: number; dias: Array<{ fecha: string; slots: Slot[] }> }
export interface DatosCita {
  pacienteId: number | null;
  terapeutaId: number | null;
  salaId: number | null;
  fecha: string;
  horaInicio: string;
  duracion: number;
  estado?: EstadoCita;
}
export interface FiltrosCitas {
  q: string;
  estado: EstadoCita | '';
  salaId: string;
  terapeutaId: string;
  periodo: Periodo | '';
  fecha: string;
  page: number;
}
export interface ResultadoListado {
  citas: Cita[];
  conteos: { todas: number; pendientes: number; canceladas: number; vencidas: number };
  total: number;
  page: number;
  limit: number;
}

function json(method: string, datos: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) };
}

// ---------- Fechas y formato ----------

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fechaUTC(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

export function hoyLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function sumarDias(fecha: string, dias: number): string {
  const d = fechaUTC(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function lunesDe(fecha: string): string {
  const dia = fechaUTC(fecha).getUTCDay();
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosAHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** "2026-09-10" → "Miércoles 10 de Septiembre 2026" */
export function fechaLarga(fecha: string): string {
  const d = fechaUTC(fecha);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-09-10" → "10 de Sep" */
export function fechaCorta(fecha: string): string {
  const d = fechaUTC(fecha);
  return `${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()].slice(0, 3)}`;
}

/** "2026-09-10" → "Miércoles 10" (encabezado de la rejilla) */
export function encabezadoDia(fecha: string): string {
  const d = fechaUTC(fecha);
  return `${DIAS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Semana del 8 al 12 de Septiembre, 2026 */
export function rangoSemana(inicio: string, fin: string): string {
  const a = fechaUTC(inicio);
  const b = fechaUTC(fin);
  const mesA = MESES[a.getUTCMonth()];
  const mesB = MESES[b.getUTCMonth()];
  const desde = mesA === mesB ? `${a.getUTCDate()}` : `${a.getUTCDate()} de ${mesA}`;
  return `Semana del ${desde} al ${b.getUTCDate()} de ${mesB}, ${b.getUTCFullYear()}`;
}

export function horario(cita: Pick<Cita, 'horaInicio' | 'horaFin' | 'duracion'>, conDuracion = false): string {
  const base = `${cita.horaInicio} - ${cita.horaFin}`;
  return conDuracion ? `${base} (Duración ${cita.duracion} mins)` : base;
}

export function horaFinDe(horaInicio: string, duracion: number): string {
  return minutosAHora(horaAMinutos(horaInicio) + duracion);
}

export const CLASES_ESTADO: Record<EstadoCita, string> = {
  Pendiente: 'bg-[#FEF3C7] text-[#B45309]',
  Cancelada: 'bg-[#FEE2E2] text-[#B91C1C]',
  Vencida: 'bg-[#F1F5F9] text-[#475569]',
};

export function pintarEstado(el: HTMLElement, estado: EstadoCita, prefijo = '') {
  el.textContent = `${prefijo}${estado}`;
  el.className = `inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${CLASES_ESTADO[estado]}`;
}

// ---------- Validación (mensajes idénticos al backend) ----------

export function validar(datos: DatosCita, { edicion = false } = {}): FieldError[] {
  const errores: FieldError[] = [];
  if (!datos.pacienteId) errores.push({ field: 'pacienteId', message: 'Selecciona un paciente.' });
  if (!datos.terapeutaId) errores.push({ field: 'terapeutaId', message: 'Selecciona un terapeuta.' });
  if (!datos.salaId) errores.push({ field: 'salaId', message: 'Selecciona una sala.' });
  if (!(DURACIONES as readonly number[]).includes(datos.duracion)) {
    errores.push({ field: 'duracion', message: 'Selecciona una duración válida (30, 60 o 90 minutos).' });
  }
  if (edicion && !ESTADOS_CITA.includes(datos.estado as EstadoCita)) {
    errores.push({ field: 'estado', message: 'Selecciona un estatus válido.' });
  }
  if (!datos.fecha) errores.push({ field: 'fecha', message: 'Selecciona una fecha válida.' });
  else if ([0, 6].includes(fechaUTC(datos.fecha).getUTCDay())) {
    errores.push({ field: 'fecha', message: 'Las citas solo pueden agendarse de lunes a viernes.' });
  }
  if (!datos.horaInicio) {
    errores.push({ field: 'horaInicio', message: 'Selecciona una hora de inicio válida.' });
  } else if (horaAMinutos(datos.horaInicio) + datos.duracion > horaAMinutos(HORA_FIN_JORNADA)) {
    errores.push({ field: 'duracion', message: `La cita debe terminar a más tardar a las ${HORA_FIN_JORNADA}.` });
  }
  const estado = edicion ? datos.estado : 'Pendiente';
  if (datos.fecha && datos.horaInicio && estado === 'Pendiente') {
    const ahora = new Date();
    const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    const hoy = hoyLocal();
    if (datos.fecha < hoy || (datos.fecha === hoy && datos.horaInicio <= hora)) {
      errores.push({ field: 'horaInicio', message: 'No es posible agendar una cita en un horario que ya pasó.' });
    }
  }
  return errores;
}

// ---------- API ----------

export async function listarCitas(filtros: FiltrosCitas): Promise<ResultadoListado> {
  const params = new URLSearchParams({ page: String(filtros.page) });
  for (const clave of ['q', 'estado', 'salaId', 'terapeutaId', 'periodo', 'fecha'] as const) {
    if (filtros[clave]) params.set(clave, String(filtros[clave]));
  }
  const { response, body } = await pedir(`/citas?${params}`);
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? body?.error ?? 'No se pudo cargar la lista de citas.');
  return body;
}

export async function obtenerCita(id: string | null): Promise<Cita | null> {
  if (!id || !/^\d+$/.test(id)) return null;
  const { response, body } = await pedir(`/citas/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(body?.error ?? 'No se pudo cargar la cita.');
  return body.cita;
}

/** RF 5.4.2: null si no existe una cita con ese folio. Lanza con el mensaje del backend si el formato es inválido. */
export async function obtenerCitaPorFolio(folio: string): Promise<Cita | null> {
  const { response, body } = await pedir(`/citas/folio/${encodeURIComponent(folio)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? body?.error ?? 'No se pudo buscar la cita.');
  return body.cita;
}

export async function disponibilidadSemana(terapeutaId: number, semana: string, duracion: number, excluir?: number): Promise<Semana> {
  const params = new URLSearchParams({ terapeutaId: String(terapeutaId), semana, duracion: String(duracion) });
  if (excluir) params.set('excluir', String(excluir));
  const { response, body } = await pedir(`/citas/disponibilidad?${params}`);
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? body?.error ?? 'No se pudo consultar la disponibilidad.');
  return body;
}

/** RF 5.1.14: resultado del envío de la confirmación al paciente (backend/src/utils/notificador.js). */
export type Notificacion =
  | { enviada: true; destino: string }
  | { enviada: false; motivo: 'sin_correo' | 'no_aplica' | 'error' };

/** Texto para el aviso de la pantalla; null cuando no aplica (la cita ya no está Pendiente). */
export function textoNotificacion(n: { enviada: boolean; destino?: string; motivo?: string } | undefined): string | null {
  if (!n) return null;
  if (n.enviada) return n.destino ? `Se envió la confirmación a ${n.destino}.` : 'Se envió la confirmación al correo del paciente.';
  if (n.motivo === 'sin_correo') return 'El paciente no tiene correo registrado; no se envió confirmación.';
  if (n.motivo === 'error') return 'No se pudo enviar la confirmación por correo.';
  return null;
}

type ResultadoGuardar = { cita?: Cita; notificacion?: Notificacion; errores?: FieldError[] };

async function guardar(ruta: string, method: string, datos: DatosCita): Promise<ResultadoGuardar> {
  const { response, body } = await pedir(ruta, json(method, datos));
  if (response.ok) return { cita: body.cita, notificacion: body.notificacion };
  if (body?.errors) return { errores: body.errors };
  throw new Error(body?.error ?? 'No se pudo guardar la cita.');
}

export function crearCita(datos: DatosCita) {
  return guardar('/citas', 'POST', datos);
}

export function actualizarCita(id: number, datos: DatosCita) {
  return guardar(`/citas/${id}`, 'PUT', datos);
}

export async function cancelarCita(id: number): Promise<Cita> {
  const { response, body } = await pedir(`/citas/${id}/cancelar`, { method: 'PATCH' });
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? body?.error ?? 'No se pudo cancelar la cita.');
  return body.cita;
}

// ---------- Componentes de interfaz ----------

export interface Selector {
  valor(): Referencia | null;
  fijar(ref: Referencia | null): void;
  error(mensaje: string | null): void;
  alCambiar(fn: (ref: Referencia | null) => void): void;
}

/**
 * Combobox con búsqueda (SelectorBuscable.astro). `buscar` devuelve las opciones para un texto;
 * con texto vacío puede devolver una lista inicial.
 */
export function iniciarSelector(raiz: HTMLElement, buscar: (q: string) => Promise<Referencia[]>): Selector {
  const input = raiz.querySelector('input') as HTMLInputElement;
  const lista = raiz.querySelector('[role="listbox"]') as HTMLElement;
  const errorEl = raiz.querySelector('[data-error]') as HTMLElement;
  const plantilla = raiz.querySelector('template') as HTMLTemplateElement;
  let seleccion: Referencia | null = null;
  let opciones: Referencia[] = [];
  let activa = -1;
  let consulta = 0;
  const oyentes: Array<(ref: Referencia | null) => void> = [];

  function cerrar() {
    lista.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
  }

  function pintar() {
    lista.replaceChildren(...opciones.map((op, i) => {
      const nodo = (plantilla.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
      nodo.id = `${raiz.id}-op-${op.id}`;
      nodo.querySelector('[data-nombre]')!.textContent = op.nombre;
      nodo.setAttribute('aria-selected', String(seleccion?.id === op.id));
      nodo.querySelector('[data-check]')!.classList.toggle('invisible', seleccion?.id !== op.id);
      nodo.classList.toggle('bg-[#F1F5F9]', i === activa);
      nodo.addEventListener('mousedown', (e) => { e.preventDefault(); elegir(op); });
      return nodo;
    }));
    if (opciones.length === 0) {
      const vacio = document.createElement('li');
      vacio.className = 'px-3 py-2.5 text-sm text-[#94A3B8]';
      vacio.textContent = input.value.trim() ? 'Sin resultados.' : 'Escribe para buscar…';
      lista.append(vacio);
    }
    lista.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', activa >= 0 && opciones[activa] ? `${raiz.id}-op-${opciones[activa].id}` : '');
  }

  async function cargar() {
    const id = ++consulta;
    try {
      const resultado = await buscar(input.value.trim());
      if (id !== consulta) return;
      opciones = resultado;
      activa = opciones.findIndex((o) => o.id === seleccion?.id);
      pintar();
    } catch {
      if (id === consulta) { opciones = []; pintar(); }
    }
  }

  function elegir(op: Referencia | null) {
    seleccion = op;
    input.value = op?.nombre ?? '';
    error(null);
    cerrar();
    oyentes.forEach((fn) => fn(op));
  }

  function error(mensaje: string | null) {
    errorEl.textContent = mensaje ?? '';
    errorEl.classList.toggle('hidden', !mensaje);
    if (mensaje) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  let temporizador: number | undefined;
  input.addEventListener('focus', () => { input.select(); cargar(); });
  input.addEventListener('input', () => {
    if (seleccion && input.value !== seleccion.nombre) { seleccion = null; oyentes.forEach((fn) => fn(null)); }
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(cargar, 200);
  });
  input.addEventListener('blur', () => { cerrar(); if (seleccion) input.value = seleccion.nombre; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (lista.classList.contains('hidden')) { cargar(); return; }
      activa = Math.max(0, Math.min(opciones.length - 1, activa + (e.key === 'ArrowDown' ? 1 : -1)));
      pintar();
    } else if (e.key === 'Enter' && !lista.classList.contains('hidden') && opciones[activa]) {
      e.preventDefault();
      elegir(opciones[activa]);
    } else if (e.key === 'Escape') {
      cerrar();
    }
  });

  return {
    valor: () => seleccion,
    fijar: (ref) => { seleccion = ref; input.value = ref?.nombre ?? ''; },
    error,
    alCambiar: (fn) => oyentes.push(fn),
  };
}

/** Búsqueda de pacientes activos por nombre/CURP (endpoint existente de pacientes). */
export async function opcionesPacientes(q: string): Promise<Referencia[]> {
  if (!q) return [];
  const resultado = await buscarPacientes(q);
  return resultado.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }));
}

/** Terapeutas activos, filtrados en el servidor por nombre/correo/cédula. */
export async function opcionesTerapeutas(q: string): Promise<Referencia[]> {
  const lista = await listarTerapeutas({ q, estado: 'activos', orden: 'nombre' });
  return lista.map((t) => ({ id: t.id, nombre: t.nombre }));
}

export { listarSalas };

export interface Rejilla {
  cargar(): Promise<void>;
  configurar(opciones: { terapeutaId: number | null; duracion?: number; semana?: string; excluir?: number }): void;
  seleccion(): { fecha: string; slot: Slot } | null;
  fijarSeleccion(fecha: string, horaInicio: string): void;
  alSeleccionar(fn: (sel: { fecha: string; slot: Slot } | null) => void): void;
}

/** RF 5.1.3: rejilla semanal de disponibilidad (RejillaSemanal.astro). */
export function iniciarRejilla(raiz: HTMLElement): Rejilla {
  const cuerpo = raiz.querySelector('[data-cuerpo]') as HTMLElement;
  const cabecera = raiz.querySelector('[data-cabecera]') as HTMLElement;
  const rango = raiz.querySelector('[data-rango]') as HTMLElement;
  const estadoEl = raiz.querySelector('[data-estado]') as HTMLElement;
  const anterior = raiz.querySelector('[data-anterior]') as HTMLButtonElement;
  const siguiente = raiz.querySelector('[data-siguiente]') as HTMLButtonElement;
  let terapeutaId: number | null = null;
  let duracion = DURACION_PREDETERMINADA;
  let semana = lunesDe(hoyLocal());
  let excluir: number | undefined;
  let datos: Semana | null = null;
  let actual: { fecha: string; horaInicio: string } | null = null;
  let consulta = 0;
  const oyentes: Array<(sel: { fecha: string; slot: Slot } | null) => void> = [];

  function buscarSeleccion() {
    if (!actual || !datos) return null;
    const dia = datos.dias.find((d) => d.fecha === actual!.fecha);
    const slot = dia?.slots.find((s) => s.horaInicio === actual!.horaInicio);
    return slot && slot.estado === 'disponible' ? { fecha: actual.fecha, slot } : null;
  }

  function notificar() {
    const sel = buscarSeleccion();
    oyentes.forEach((fn) => fn(sel));
  }

  function mensaje(texto: string | null, error = false) {
    estadoEl.textContent = texto ?? '';
    estadoEl.className = texto ? `text-sm ${error ? 'text-red-600' : 'text-[#64748B]'}` : 'hidden';
  }

  function etiqueta(slot: Slot): string {
    if (slot.estado === 'disponible') {
      return slot.salasLibres.length === 1 ? `${slot.salasLibres[0].nombre} Lib.` : `${slot.salasLibres.length} salas lib.`;
    }
    if (slot.motivo === 'terapeuta') return 'Terapeuta ocupado';
    if (slot.motivo === 'salas') return 'Sin salas';
    return '';
  }

  function pintar() {
    if (!datos) { cabecera.replaceChildren(); cuerpo.replaceChildren(); return; }
    rango.textContent = rangoSemana(datos.semana.inicio, datos.semana.fin);
    anterior.disabled = datos.semana.inicio <= lunesDe(hoyLocal());

    const th = (texto: string, clases = '') => {
      const el = document.createElement('th');
      el.scope = 'col';
      el.className = `px-2 py-2.5 text-[12px] font-semibold text-[#0F172A] ${clases}`;
      el.textContent = texto;
      return el;
    };
    cabecera.replaceChildren(th('Hora', 'text-left text-[#475569] w-16'), ...datos.dias.map((d) => th(encabezadoDia(d.fecha))));

    const filas = datos.dias[0].slots.map((_, i) => {
      const tr = document.createElement('tr');
      tr.className = 'border-t border-[#E2E8F0]';
      const hora = document.createElement('th');
      hora.scope = 'row';
      hora.className = 'px-2 py-1.5 text-left text-[12px] font-medium text-[#475569]';
      hora.textContent = datos!.dias[0].slots[i].horaInicio;
      tr.append(hora);
      for (const dia of datos!.dias) {
        const slot = dia.slots[i];
        const td = document.createElement('td');
        td.className = 'px-1 py-1';
        const boton = document.createElement('button');
        boton.type = 'button';
        const elegido = actual?.fecha === dia.fecha && actual.horaInicio === slot.horaInicio && slot.estado === 'disponible';
        const disponible = slot.estado === 'disponible';
        boton.disabled = !disponible;
        boton.dataset.fecha = dia.fecha;
        boton.dataset.hora = slot.horaInicio;
        boton.setAttribute('aria-pressed', String(elegido));
        boton.setAttribute('aria-label', `${fechaLarga(dia.fecha)}, ${slot.horaInicio} a ${slot.horaFin}: ${disponible ? etiqueta(slot) : 'no disponible'}`);
        boton.className = `w-full h-8 px-1 rounded-[6px] border text-[11px] font-medium truncate transition-colors ${
          elegido
            ? 'bg-[#0D9488] border-[#0D9488] text-white font-semibold'
            : disponible
              ? 'bg-[#CCFBF1] border-[#0D9488] text-[#115E59] hover:bg-[#99F6E4] cursor-pointer'
              : 'bg-[#F8FAFC] border-transparent text-[#94A3B8] cursor-not-allowed'
        }`;
        boton.textContent = elegido ? '✓ Seleccionado' : etiqueta(slot);
        td.append(boton);
        tr.append(td);
      }
      return tr;
    });
    cuerpo.replaceChildren(...filas);
  }

  cuerpo.addEventListener('click', (e) => {
    const boton = (e.target as HTMLElement).closest('button');
    if (!boton || boton.disabled) return;
    actual = { fecha: boton.dataset.fecha!, horaInicio: boton.dataset.hora! };
    pintar();
    notificar();
  });

  async function cargar() {
    if (!terapeutaId) {
      datos = null;
      pintar();
      mensaje('Selecciona un terapeuta para ver los horarios disponibles.');
      return;
    }
    const id = ++consulta;
    mensaje('Cargando disponibilidad…');
    try {
      const resultado = await disponibilidadSemana(terapeutaId, semana, duracion, excluir);
      if (id !== consulta) return;
      datos = resultado;
      mensaje(null);
      pintar();
      notificar();
    } catch (err) {
      if (id === consulta) mensaje(err instanceof Error ? err.message : 'No se pudo consultar la disponibilidad.', true);
    }
  }

  anterior.addEventListener('click', () => { semana = sumarDias(semana, -7); cargar(); });
  siguiente.addEventListener('click', () => { semana = sumarDias(semana, 7); cargar(); });

  return {
    cargar,
    configurar(op) {
      terapeutaId = op.terapeutaId;
      if (op.duracion) duracion = op.duracion;
      if (op.semana) semana = lunesDe(op.semana);
      if (op.excluir) excluir = op.excluir;
    },
    seleccion: buscarSeleccion,
    fijarSeleccion(fecha, horaInicio) { actual = { fecha, horaInicio }; },
    alSeleccionar: (fn) => oyentes.push(fn),
  };
}

/** Rellena un <select> de salas con las libres del slot, conservando la elegida si sigue libre. */
export function llenarSalas(select: HTMLSelectElement, salas: Sala[], preferida?: number | null) {
  const previa = preferida ?? Number(select.value);
  select.replaceChildren(...salas.map((s) => new Option(s.nombre, String(s.id))));
  if (salas.some((s) => s.id === previa)) select.value = String(previa);
  select.disabled = salas.length === 0;
}

export function mostrarErrorCampo(id: string, mensaje: string | null) {
  const el = document.getElementById(`${id}-error`);
  if (!el) return;
  el.textContent = mensaje ?? '';
  el.classList.toggle('hidden', !mensaje);
}
