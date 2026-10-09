import { API_URL } from './sesion';

export type EstadoCita = 'Pendiente' | 'Cancelada' | 'Vencida';
export type TipoVista = 'dia' | 'semana' | 'mes';

export interface Cita {
  id: string | number;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  duracion?: string;
  paciente: string;
  pacienteMes?: string;
  pacienteSemana?: string;
  terapeuta: string;
  sala: string;
  salaCorta?: string;
  estado: EstadoCita;
  folio: string;
}

export interface CitaItem {
  id: number;
  folio: string;
  estado: EstadoCita;
  pacienteId: number;
  paciente: string;
  terapeutaId: number;
  terapeuta: string;
  salaId: number;
  sala: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface CitaDetalle extends CitaItem {
  bloques: number[];
}

export interface ContadoresCitas {
  todas: number;
  pendientes: number;
  canceladas: number;
  vencidas: number;
}

export interface RespuestaListadoCitas {
  citas: CitaItem[];
  total: number;
  page: number;
  totalPages: number;
  contadores: ContadoresCitas;
}

export interface SalaOpcion {
  id: number;
  nombre: string;
}

export interface TerapeutaOpcion {
  id: number;
  nombre: string;
}

export interface FiltrosCitas {
  q?: string;
  estado?: string;
  salaId?: number | string;
  terapeutaId?: number | string;
  tiempo?: 'dia' | 'semana' | 'mes' | 'todos';
  page?: number;
  limit?: number;
}

// --- Peticiones API ---

async function fetchAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('Sesión expirada');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMsg = data?.error || data?.errors?.[0]?.message || `Error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function listarCitasApi(filtros: FiltrosCitas = {}): Promise<RespuestaListadoCitas> {
  const params = new URLSearchParams();
  if (filtros.q) params.set('q', filtros.q.trim());
  if (filtros.estado && filtros.estado !== 'Todas') params.set('estado', filtros.estado);
  if (filtros.salaId) params.set('salaId', String(filtros.salaId));
  if (filtros.terapeutaId) params.set('terapeutaId', String(filtros.terapeutaId));
  if (filtros.tiempo && filtros.tiempo !== 'todos') params.set('tiempo', filtros.tiempo);
  if (filtros.page) params.set('page', String(filtros.page));
  if (filtros.limit) params.set('limit', String(filtros.limit));

  return fetchAuth<RespuestaListadoCitas>(`${API_URL}/citas?${params.toString()}`);
}

export async function obtenerCitaApi(id: string | number): Promise<CitaDetalle> {
  const res = await fetchAuth<{ cita: CitaDetalle }>(`${API_URL}/citas/${id}`);
  return res.cita;
}

export async function actualizarCitaApi(
  id: string | number,
  datos: {
    estado?: EstadoCita;
    pacienteId?: number;
    terapeutaId?: number;
    salaId?: number;
  }
): Promise<CitaDetalle> {
  const res = await fetchAuth<{ cita: CitaDetalle; message: string }>(`${API_URL}/citas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return res.cita;
}

export async function cancelarCitaApi(id: string | number): Promise<void> {
  await fetchAuth<{ message: string }>(`${API_URL}/citas/${id}`, {
    method: 'DELETE',
  });
}

export async function listarSalasApi(): Promise<SalaOpcion[]> {
  const res = await fetchAuth<{ salas: SalaOpcion[] }>(`${API_URL}/citas/salas`);
  return res.salas || [];
}

export async function listarTerapeutasApi(): Promise<TerapeutaOpcion[]> {
  const res = await fetchAuth<{ terapeutas: Array<{ id: number; nombre: string }> }>(`${API_URL}/terapeutas?estado=activos`);
  return res.terapeutas || [];
}

// --- Constantes para vistas de Calendario ---

export const HORARIOS_DIA: string[] = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

export const HORARIOS_SEMANA: string[] = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
];

export const NOMBRES_MESES: string[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MESES_CORTOS: string[] = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const NOMBRES_DIAS_COMPLETO: string[] = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

// --- Formateadores de Fechas ---

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatFechaISO(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

export function getLunesDeSemana(date: Date): Date {
  const d = new Date(date);
  const diaSemana = d.getDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Formatea "2026-09-10" y "10:00" a "10 de Sep, 10:00" */
export function formatearFechaTabla(fechaIso: string, horaStr: string): string {
  if (!fechaIso) return horaStr || 'Por programar';
  const parts = fechaIso.split('-');
  if (parts.length < 3) return `${fechaIso} ${horaStr}`;
  const dia = parseInt(parts[2], 10);
  const mesIndex = parseInt(parts[1], 10) - 1;
  const mes = MESES_CORTOS[mesIndex] || parts[1];
  return `${dia} de ${mes}, ${horaStr.slice(0, 5)}`;
}

/** Formatea "2026-09-10", "10:00", "11:00" a "Miércoles 10 de Sep 2026, 10:00 - 11:00 AM" */
export function formatearFechaLargaDetalle(fechaIso: string, inicio: string, fin: string): string {
  if (!fechaIso) return 'Horario no definido';
  const parts = fechaIso.split('-').map(Number);
  if (parts.length < 3) return `${fechaIso} ${inicio}-${fin}`;
  const fecha = new Date(parts[0], parts[1] - 1, parts[2]);
  const diaNombre = NOMBRES_DIAS_COMPLETO[fecha.getDay()] || '';
  const diaNum = parts[2];
  const mesNombre = MESES_CORTOS[parts[1] - 1] || '';
  const anio = parts[0];

  function formatearHora12(h: string): string {
    if (!h) return '';
    const [hh, mm] = h.slice(0, 5).split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${padZero(h12)}:${padZero(mm)} ${ampm}`;
  }

  const horaStr = inicio && fin 
    ? `${inicio.slice(0, 5)} - ${fin.slice(0, 5)}`
    : inicio.slice(0, 5);

  return `${diaNombre} ${diaNum} de ${mesNombre} ${anio}, ${horaStr}`;
}
