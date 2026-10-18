import { pedirApi as pedir } from './sesion';
import { listarTerapeutas } from './terapeuta';
import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  MINUTOS_BLOQUE,
  horaAMinutos,
  hoyLocal,
  listarSalas,
  lunesDe,
  minutosAHora,
  sumarDias,
  type Cita,
} from './cita';

export type Vista = 'dia' | 'semana' | 'mes';
export interface FiltrosAgenda { vista: Vista; fecha: string; terapeutaId: string; salaId: string }
export interface Agenda { vista: Vista; fecha: string; desde: string; hasta: string; citas: Cita[] }

export const VISTAS: Vista[] = ['dia', 'semana', 'mes'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** RF 6.1: citas Pendientes y Vencidas del periodo de la vista. */
export async function obtenerAgenda(filtros: FiltrosAgenda): Promise<Agenda> {
  const params = new URLSearchParams({ vista: filtros.vista, fecha: filtros.fecha });
  if (filtros.terapeutaId) params.set('terapeutaId', filtros.terapeutaId);
  if (filtros.salaId) params.set('salaId', filtros.salaId);
  const { response, body } = await pedir(`/agenda?${params}`);
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? body?.error ?? 'No se pudo cargar la agenda.');
  return body;
}

// ---------- Fechas ----------

function partes(fecha: string) {
  const d = new Date(`${fecha}T00:00:00Z`);
  return { dia: d.getUTCDate(), mes: d.getUTCMonth(), anio: d.getUTCFullYear(), semana: d.getUTCDay() };
}

/** Mueve la fecha de referencia un periodo hacia atrás (-1) o adelante (+1). */
export function avanzar(vista: Vista, fecha: string, direccion: 1 | -1): string {
  if (vista === 'dia') return sumarDias(fecha, direccion);
  if (vista === 'semana') return sumarDias(fecha, 7 * direccion);
  const { mes, anio } = partes(fecha);
  const destino = new Date(Date.UTC(anio, mes + direccion, 1));
  return destino.toISOString().slice(0, 10);
}

/** "Lunes, 12 de Octubre 2026" · "Semana del 12 - 16 de Octubre 2026" · "Octubre 2026" */
export function tituloPeriodo(vista: Vista, fecha: string): string {
  const p = partes(fecha);
  if (vista === 'dia') return `${DIAS[p.semana]}, ${p.dia} de ${MESES[p.mes]} ${p.anio}`;
  if (vista === 'mes') return `${MESES[p.mes]} ${p.anio}`;
  const lunes = partes(lunesDe(fecha));
  const viernes = partes(sumarDias(lunesDe(fecha), 4));
  const desde = lunes.mes === viernes.mes ? `${lunes.dia}` : `${lunes.dia} de ${MESES[lunes.mes]}`;
  return `Semana del ${desde} - ${viernes.dia} de ${MESES[viernes.mes]} ${viernes.anio}`;
}

/** "Lunes, 12 Oct 2026" (encabezado de la hoja impresa). */
export function fechaImpresion(fecha: string): string {
  const p = partes(fecha);
  return `${DIAS[p.semana]}, ${p.dia} ${MESES[p.mes].slice(0, 3)} ${p.anio}`;
}

export function duracionCorta(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}` : `${h}h`;
}

/** Inicios de bloque de la jornada: 07:00, 07:30, … 16:30. */
export function slotsJornada(): string[] {
  const slots = [];
  for (let m = horaAMinutos(HORA_INICIO_JORNADA); m < horaAMinutos(HORA_FIN_JORNADA); m += MINUTOS_BLOQUE) slots.push(minutosAHora(m));
  return slots;
}

/** Horas en punto de la jornada para la vista semanal: 07:00 … 16:00. */
export function horasJornada(): string[] {
  return slotsJornada().filter((h) => h.endsWith(':00'));
}

export function diasSemana(fecha: string): string[] {
  const lunes = lunesDe(fecha);
  return [0, 1, 2, 3, 4].map((i) => sumarDias(lunes, i));
}

/** Semanas completas (lunes–domingo) que cubren el mes de la fecha. */
export function semanasMes(fecha: string): string[][] {
  const { mes, anio } = partes(fecha);
  const primero = new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10);
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).toISOString().slice(0, 10);
  const semanas: string[][] = [];
  for (let lunes = lunesDe(primero); lunes <= ultimo; lunes = sumarDias(lunes, 7)) {
    semanas.push([0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(lunes, i)));
  }
  return semanas;
}

export function agruparPor<T>(lista: T[], clave: (x: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const x of lista) {
    const k = clave(x);
    mapa.set(k, [...(mapa.get(k) ?? []), x]);
  }
  return mapa;
}

/** "Ana Beatriz Canul Dzib" → "Ana Beatriz" en el mes (espacio reducido). */
function nombreBreve(nombre: string): string {
  return nombre.split(/\s+/).slice(0, 2).join(' ');
}

// ---------- Render ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase = '', texto?: string): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

/** Alterna teal/verde por sala para distinguir salas que coinciden en el mismo horario. */
function colorSala(cita: Cita) {
  return cita.sala.id % 2
    ? { fondo: 'bg-[#CCFBF1]', texto: 'text-[#0D9488]' }
    : { fondo: 'bg-[#DCFCE7]', texto: 'text-[#006847]' };
}

function enlaceCita(cita: Cita, clase: string): HTMLAnchorElement {
  const a = el('a', `${clase} ${cita.estado === 'Vencida' ? 'opacity-60' : ''}`);
  a.href = `/citas/editar?id=${cita.id}`;
  a.title = `${cita.folio} · ${cita.paciente.nombre} · ${cita.horaInicio}-${cita.horaFin} · ${cita.sala.nombre}${cita.estado === 'Vencida' ? ' · Vencida' : ''}`;
  return a;
}

/** RF 6.1 (día): filas de 30 min; cada cita aparece en el bloque en que inicia. */
export function renderDia(agenda: Agenda): HTMLElement {
  const porHora = agruparPor(agenda.citas, (c) => c.horaInicio);
  const lista = el('ol', 'flex flex-col gap-2');
  for (const hora of slotsJornada()) {
    const fila = el('li', 'grid grid-cols-[56px_1fr] gap-4 items-center');
    fila.append(el('span', 'text-[13px] font-semibold text-[#334155]', hora));
    const citas = porHora.get(hora) ?? [];
    const contenido = el('div', 'flex flex-col gap-2 min-w-0');
    if (!citas.length) {
      contenido.append(el('p', 'px-3 py-2.5 rounded-lg border border-dashed border-[#E2E8F0] text-[11px] text-[#64748B]', 'Espacio disponible para cita'));
    }
    for (const cita of citas) {
      const tarjeta = enlaceCita(cita, 'flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-[#0D9488] bg-[#F0FDFA] hover:bg-[#CCFBF1] transition-colors');
      const info = el('div', 'min-w-0');
      info.append(el('p', 'text-[13px] font-bold text-[#0F172A] truncate', cita.paciente.nombre));
      const detalle = el('p', 'flex flex-wrap items-center gap-x-2 text-[11px] text-[#64748B]');
      detalle.append(
        el('span', '', `Tutor/Terapeuta: ${cita.terapeuta.nombre}`),
        el('span', 'text-[#94A3B8]', '•'),
        el('span', 'font-semibold text-[#0D9488]', cita.sala.nombre),
        el('span', 'text-[#94A3B8]', '•'),
        el('span', '', `${cita.horaInicio} - ${cita.horaFin}`),
      );
      info.append(detalle);
      const etiquetas = el('div', 'flex items-center gap-1.5 shrink-0');
      if (cita.estado === 'Vencida') etiquetas.append(el('span', 'px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[10px] font-bold text-[#475569]', 'Vencida'));
      etiquetas.append(el('span', 'px-2 py-0.5 rounded-md bg-[#CCFBF1] text-[10px] font-bold text-[#115E59]', duracionCorta(cita.duracion)));
      tarjeta.append(info, etiquetas);
      contenido.append(tarjeta);
    }
    fila.append(contenido);
    lista.append(fila);
  }
  return lista;
}

/** RF 6.1 (semana): Lun–Vie × filas de 1 h; cada cita en la hora en que inicia. */
export function renderSemana(agenda: Agenda): HTMLElement {
  const dias = diasSemana(agenda.fecha);
  const hoy = hoyLocal();
  const porCelda = agruparPor(agenda.citas, (c) => `${c.fecha} ${c.horaInicio.slice(0, 2)}`);
  const tabla = el('div', 'grid grid-cols-[48px_repeat(5,minmax(0,1fr))] gap-2 min-w-[640px]');
  tabla.append(el('span'));
  for (const fecha of dias) {
    const p = partes(fecha);
    const esHoy = fecha === hoy;
    const cab = el('div', `flex flex-col items-center py-2 rounded-md ${esHoy ? 'bg-[#CCFBF1]' : 'bg-[#F1F5F9]'}`);
    cab.append(
      el('span', 'text-[10px] font-semibold uppercase text-[#64748B]', DIAS[p.semana].slice(0, 3)),
      el('span', `text-[16px] font-extrabold ${esHoy ? 'text-[#0F766E]' : 'text-[#0F172A]'}`, String(p.dia)),
    );
    tabla.append(cab);
  }
  for (const hora of horasJornada()) {
    tabla.append(el('span', 'pt-3 text-[12px] font-semibold text-[#475569]', hora));
    for (const fecha of dias) {
      const citas = porCelda.get(`${fecha} ${hora.slice(0, 2)}`) ?? [];
      const celda = el('div', 'flex flex-col gap-1 min-h-[44px] p-1 rounded-md border border-[#E2E8F0] min-w-0');
      if (!citas.length) celda.append(el('span', 'm-auto text-[10px] text-[#94A1B0]', '-'));
      for (const cita of citas) {
        const { fondo, texto } = colorSala(cita);
        const chip = enlaceCita(cita, `flex flex-col px-1.5 py-1 rounded ${fondo} hover:brightness-95 min-w-0`);
        chip.append(
          el('span', 'text-[11px] font-bold text-[#0F172A] truncate', cita.paciente.nombre),
          el('span', `text-[9px] font-semibold ${texto} truncate`, `${cita.horaInicio.endsWith(':30') ? `${cita.horaInicio} · ` : ''}${cita.sala.nombre}`),
        );
        celda.append(chip);
      }
      tabla.append(celda);
    }
  }
  return tabla;
}

const MAX_CHIPS_MES = 2;

/** RF 6.1 (mes): cuadrícula Lun–Dom; clic en un día abre su vista de día. */
export function renderMes(agenda: Agenda, alElegirDia: (fecha: string) => void): HTMLElement {
  const mesActual = agenda.desde.slice(0, 7);
  const hoy = hoyLocal();
  const porDia = agruparPor(agenda.citas, (c) => c.fecha);
  const cont = el('div', 'grid grid-cols-7 gap-2 min-w-[640px]');
  for (const nombre of ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']) {
    cont.append(el('span', 'py-1.5 rounded-md bg-[#F1F5F9] text-center text-[12px] font-medium text-[#475569]', nombre));
  }
  for (const semana of semanasMes(agenda.fecha)) {
    for (const fecha of semana) {
      const delMes = fecha.slice(0, 7) === mesActual;
      const citas = delMes ? porDia.get(fecha) ?? [] : [];
      const celda = el('button', `flex flex-col gap-1 min-h-[88px] p-2 rounded-lg border text-left min-w-0 ${
        delMes ? 'border-[#E2E8F0] bg-white hover:border-[#0D9488] cursor-pointer' : 'border-[#F1F5F9] bg-[#F8FAFC] cursor-default'
      } ${fecha === hoy ? 'ring-2 ring-[#0D9488]/40' : ''}`);
      celda.type = 'button';
      celda.disabled = !delMes;
      const cab = el('span', 'flex items-center justify-between');
      cab.append(el('span', `text-[13px] ${!delMes ? 'text-[#94A3B8]' : citas.length ? 'font-bold text-[#006847]' : 'text-[#334155]'}`, String(partes(fecha).dia)));
      if (citas.length) cab.append(el('span', 'size-1.5 rounded-full bg-[#0D9488]'));
      celda.append(cab);
      for (const cita of citas.slice(0, MAX_CHIPS_MES)) {
        const { fondo } = colorSala(cita);
        celda.append(el('span', `px-1.5 py-0.5 rounded ${fondo} text-[10px] font-semibold text-[#0F172A] truncate ${cita.estado === 'Vencida' ? 'opacity-60' : ''}`, nombreBreve(cita.paciente.nombre)));
      }
      if (citas.length > MAX_CHIPS_MES) celda.append(el('span', 'text-[10px] font-semibold text-[#475569]', `+${citas.length - MAX_CHIPS_MES} más`));
      if (delMes) {
        celda.setAttribute('aria-label', `${tituloPeriodo('dia', fecha)}: ${citas.length ? `${citas.length} cita(s)` : 'sin citas'}`);
        celda.addEventListener('click', () => alElegirDia(fecha));
      }
      cont.append(celda);
    }
  }
  return cont;
}

// ---------- Página ----------

const ENCABEZADOS: Record<Vista, [string, string]> = {
  dia: ['Agenda del Día', 'Gestión y ocupación de consultorios del día'],
  semana: ['Agenda Semanal', 'Ocupación semanal de la clínica'],
  mes: ['Agenda Mensual', 'Ocupación del mes'],
};

/** RF 6.1.1–6.1.2 / RF 7.1: pantalla de inicio con la agenda (pages/inicio.astro). */
export function iniciarAgenda(): { estado: () => FiltrosAgenda; nombresFiltros: () => string[] } {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const contenedor = $('vista-agenda');
  const mensaje = $('estado-agenda');
  const filtroTerapeuta = $<HTMLSelectElement>('filtro-terapeuta');
  const filtroSala = $<HTMLSelectElement>('filtro-sala');

  const url = new URLSearchParams(location.search);
  const estado: FiltrosAgenda = {
    vista: VISTAS.includes(url.get('vista') as Vista) ? (url.get('vista') as Vista) : 'dia',
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(url.get('fecha') ?? '') ? url.get('fecha')! : hoyLocal(),
    terapeutaId: url.get('terapeutaId') ?? '',
    salaId: url.get('salaId') ?? '',
  };
  let consulta = 0;

  function sincronizarUrl() {
    const params = new URLSearchParams();
    if (estado.vista !== 'dia') params.set('vista', estado.vista);
    if (estado.fecha !== hoyLocal()) params.set('fecha', estado.fecha);
    if (estado.terapeutaId) params.set('terapeutaId', estado.terapeutaId);
    if (estado.salaId) params.set('salaId', estado.salaId);
    history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
  }

  function pintarControles() {
    const [titulo, subtitulo] = ENCABEZADOS[estado.vista];
    $('titulo-vista').textContent = titulo;
    $('subtitulo-vista').textContent = subtitulo;
    $('titulo-periodo').textContent = tituloPeriodo(estado.vista, estado.fecha);
    $('horario-jornada').hidden = estado.vista !== 'dia';
    document.querySelectorAll<HTMLElement>('[data-vista]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.vista === estado.vista));
    });
  }

  async function cargar({ silencioso = false } = {}) {
    const id = ++consulta;
    sincronizarUrl();
    pintarControles();
    if (!silencioso) {
      mensaje.textContent = 'Cargando agenda…';
      mensaje.className = 'py-6 text-center text-sm text-[#64748B]';
    }
    try {
      const agenda = await obtenerAgenda(estado);
      if (id !== consulta) return;
      const vista = agenda.vista === 'dia' ? renderDia(agenda)
        : agenda.vista === 'semana' ? renderSemana(agenda)
          : renderMes(agenda, (fecha) => { estado.vista = 'dia'; estado.fecha = fecha; cargar(); });
      contenedor.replaceChildren(vista);
      const vacia = agenda.citas.length === 0;
      mensaje.textContent = vacia ? 'No hay citas programadas en este periodo.' : '';
      mensaje.className = vacia ? 'pb-2 text-center text-[13px] text-[#64748B]' : 'hidden';
    } catch (err) {
      if (id !== consulta) return;
      mensaje.textContent = err instanceof Error ? err.message : 'No se pudo cargar la agenda.';
      mensaje.className = 'py-6 text-center text-sm text-red-600';
    }
  }

  document.querySelectorAll<HTMLElement>('[data-vista]').forEach((b) => b.addEventListener('click', () => {
    estado.vista = b.dataset.vista as Vista;
    cargar();
  }));
  $('periodo-anterior').addEventListener('click', () => { estado.fecha = avanzar(estado.vista, estado.fecha, -1); cargar(); });
  $('periodo-siguiente').addEventListener('click', () => { estado.fecha = avanzar(estado.vista, estado.fecha, 1); cargar(); });
  $('periodo-hoy').addEventListener('click', () => { estado.fecha = hoyLocal(); cargar(); });
  filtroTerapeuta.addEventListener('change', () => { estado.terapeutaId = filtroTerapeuta.value; cargar(); });
  filtroSala.addEventListener('change', () => { estado.salaId = filtroSala.value; cargar(); });

  // Refleja cambios hechos en otras pestañas (alta, edición, cancelación) sin recargar a mano.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cargar({ silencioso: true }); });

  (async () => {
    const [terapeutas, salas] = await Promise.all([
      listarTerapeutas({ q: '', estado: 'todos', orden: 'nombre' }).catch(() => []),
      listarSalas().catch(() => []),
    ]);
    filtroTerapeuta.append(...terapeutas.map((t) => new Option(t.nombre, String(t.id))));
    filtroSala.append(...salas.map((s) => new Option(s.nombre, String(s.id))));
    filtroTerapeuta.value = estado.terapeutaId;
    filtroSala.value = estado.salaId;
  })();

  cargar();

  return {
    estado: () => ({ ...estado }),
    nombresFiltros: () => [
      estado.terapeutaId ? `Terapeuta: ${filtroTerapeuta.selectedOptions[0]?.text ?? ''}` : '',
      estado.salaId ? `Sala: ${filtroSala.selectedOptions[0]?.text ?? ''}` : '',
    ].filter(Boolean),
  };
}
