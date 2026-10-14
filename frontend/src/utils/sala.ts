import { API_URL } from './sesion';

export interface Sala { id: number; nombre: string }
export interface Ocupacion { horaInicio: string; horaFin: string }
export interface SalaDisponible extends Sala { estado: 'libre' | 'reservada'; ocupaciones: Ocupacion[] }
export interface ResultadoDisponibilidad {
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  fuenteOcupacion: 'citas' | 'pendiente_modulo_citas';
  salas: SalaDisponible[];
}

async function pedir(ruta: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${ruta}`, { credentials: 'include', ...init });
  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('Tu sesión expiró.');
  }
  const body = await response.json().catch(() => null);
  return { response, body };
}

export async function listarSalas(): Promise<Sala[]> {
  const { response, body } = await pedir('/salas');
  if (!response.ok) throw new Error(body?.error ?? 'No se pudo cargar la lista de salas.');
  return body.salas;
}

export async function registrarSala(nombre: string): Promise<{ sala?: Sala; errores?: Array<{ field: string; message: string }> }> {
  const { response, body } = await pedir('/salas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }),
  });
  if (response.ok) return { sala: body.sala };
  if (body?.errors) return { errores: body.errors };
  throw new Error(body?.error ?? 'No se pudo registrar la sala.');
}

export async function consultarDisponibilidad(fecha: string, horaInicio = '', horaFin = ''): Promise<ResultadoDisponibilidad> {
  const params = new URLSearchParams({ fecha });
  if (horaInicio && horaFin) {
    params.set('horaInicio', horaInicio);
    params.set('horaFin', horaFin);
  }
  const { response, body } = await pedir(`/salas/disponibilidad?${params}`);
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? body?.error ?? 'No se pudo consultar la disponibilidad.');
  return body;
}

