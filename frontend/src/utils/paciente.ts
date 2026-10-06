import { API_URL } from './sesion';

export interface PatientSearchItem {
  id: number;
  nombre: string;
  curpUltimos4: string;
  telefonoUltimos4: string;
  activo: boolean;
}

export interface PatientSearchResponse {
  pacientes: PatientSearchItem[];
}

/** Busca pacientes en el servidor; si la consulta está vacía, no hace petición. */
export async function buscarPacientes(consulta: string): Promise<PatientSearchItem[]> {
  const q = consulta.trim();
  if (!q) return [];

  const params = new URLSearchParams({ q });
  const response = await fetch(`${API_URL}/pacientes?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('Sesión expirada');
  }

  const body = (await response.json().catch(() => null)) as PatientSearchResponse | null;
  if (!response.ok) throw new Error(`GET /pacientes respondió ${response.status}`);
  if (!body || !Array.isArray(body.pacientes)) {
    throw new Error('GET /pacientes devolvió una respuesta inválida');
  }

  return body.pacientes;
}
