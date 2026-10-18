import { isUadyEmail } from './email';
import { API_URL, pedirApi as pedir } from './sesion';
import { formatearFecha, formatearTelefonoLocal, mascaraFecha } from './formato';

export interface Terapeuta {
  id: number;
  nombre: string;
  telefono: string;
  correo: string;
  /** ISO aaaa-mm-dd */
  fechaNacimiento: string;
  cedula: string;
  fotoPerfil: string | null;
  activo: boolean;
  fechaBaja: string | null;
  fechaRegistro: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';
export type OrdenFiltro = 'nombre' | 'registro';

// --- Formatos de presentación ---

export { formatearTelefono, formatearTelefonoLocal, formatearFecha, formatearFechaHora } from './formato';

/** 12 → "#T-0012" */
export function formatearId(id: number): string {
  return `#T-${String(id).padStart(4, '0')}`;
}

export function urlFoto(terapeuta: Pick<Terapeuta, 'fotoPerfil'>): string | null {
  return terapeuta.fotoPerfil ? `${API_URL}${terapeuta.fotoPerfil}` : null;
}

// --- API ---

export async function listarTerapeutas(filtros: { q: string; estado: EstadoFiltro; orden: OrdenFiltro }): Promise<Terapeuta[]> {
  const params = new URLSearchParams({ estado: filtros.estado, orden: filtros.orden });
  if (filtros.q) params.set('q', filtros.q);
  const { response, body } = await pedir(`/terapeutas?${params}`);
  if (!response.ok) throw new Error(`GET /terapeutas respondió ${response.status}`);
  return body.terapeutas;
}

/** Devuelve null si el terapeuta no existe. */
export async function obtenerTerapeuta(id: string | null): Promise<Terapeuta | null> {
  if (!id || !/^\d+$/.test(id)) return null;
  const { response, body } = await pedir(`/terapeutas/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET /terapeutas/${id} respondió ${response.status}`);
  return body.terapeuta;
}

export async function cambiarEstado(id: number, activo: boolean): Promise<Terapeuta> {
  const { response, body } = await pedir(`/terapeutas/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  });
  if (!response.ok) throw new Error(body?.error ?? 'No se pudo cambiar el estado del terapeuta.');
  return body.terapeuta;
}

// --- Formulario de registro / edición (components/FormularioTerapeuta.astro) ---

export const CAMPOS = ['foto', 'nombre', 'telefono', 'fechaNacimiento', 'correo', 'cedula'] as const;
export type Campo = (typeof CAMPOS)[number];
const CAMPOS_TEXTO = CAMPOS.filter((c) => c !== 'foto');

function validarFecha(valor: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!match) return 'La fecha de nacimiento debe tener el formato dd/mm/aaaa.';
  const [dia, mes, anio] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return 'La fecha de nacimiento no es una fecha válida.';
  }
  const hoy = new Date();
  if (fecha >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
    return 'La fecha de nacimiento debe ser anterior a la fecha de registro.';
  }
  return null;
}

/**
 * Conecta el formulario de components/FormularioTerapeuta.astro: máscaras, contador,
 * validación en cliente (mismas reglas y mensajes que backend/src/validators/terapeuta.validators.js),
 * errores por campo y envío. RF 2.1.1-2.1.9, RF 2.2.4.
 */
export function iniciarFormulario() {
  const form = document.getElementById('terapeuta-form') as HTMLFormElement;
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  const formMessage = document.getElementById('form-message') as HTMLElement;
  const fotoRaiz = form.querySelector<HTMLElement>('[data-foto-uploader]')!;
  const textoGuardar = submitBtn.textContent?.trim() ?? 'Guardar';
  const input = (campo: Campo) => document.getElementById(campo) as HTMLInputElement;

  // --- Máscaras de entrada ---

  const contador = document.getElementById('nombre-contador');
  const actualizarContador = () => {
    if (contador) contador.textContent = `${input('nombre').value.length} / 50`;
  };
  input('nombre').addEventListener('input', actualizarContador);

  input('telefono').addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    target.value = formatearTelefonoLocal(target.value);
  });

  input('fechaNacimiento').addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    target.value = mascaraFecha(target.value);
  });

  input('cedula').addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    target.value = target.value.replace(/\D/g, '').slice(0, 8);
  });

  // --- Errores ---

  function mostrarError(campo: string, mensaje: string | null): void {
    const el = document.getElementById(`${campo}-error`);
    if (el) {
      el.textContent = mensaje ?? '';
      el.classList.toggle('hidden', !mensaje);
    }
    const control = document.getElementById(campo);
    if (control && campo !== 'foto') {
      if (mensaje) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
  }

  CAMPOS_TEXTO.forEach((campo) => input(campo).addEventListener('input', () => mostrarError(campo, null)));

  function mostrarMensaje(texto: string, tipo: 'error' | 'success'): void {
    formMessage.textContent = texto;
    formMessage.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-green-50', 'text-green-700');
    formMessage.classList.add(...(tipo === 'error' ? ['bg-red-50', 'text-red-700'] : ['bg-green-50', 'text-green-700']));
  }

  function limpiarErrores(): void {
    CAMPOS.forEach((campo) => mostrarError(campo, null));
    formMessage.classList.add('hidden');
  }

  function mostrarErrores(errores: FieldError[]): void {
    errores.forEach(({ field, message }) => mostrarError(field, message));
    const primero = errores.find((e) => (CAMPOS as readonly string[]).includes(e.field));
    if (primero) input(primero.field as Campo).focus();
    else if (errores[0]) mostrarMensaje(errores[0].message, 'error');
  }

  function validar(): FieldError[] {
    const errores: FieldError[] = [];
    const nombre = input('nombre').value.trim();
    const telefono = input('telefono').value.replace(/\D/g, '');
    const fecha = input('fechaNacimiento').value.trim();
    const correo = input('correo').value.trim();
    const cedula = input('cedula').value.replace(/\D/g, '');

    if (!nombre) errores.push({ field: 'nombre', message: 'El nombre completo es obligatorio.' });
    else if (nombre.length > 50) errores.push({ field: 'nombre', message: 'El nombre completo no puede exceder 50 caracteres.' });

    if (!telefono) errores.push({ field: 'telefono', message: 'El número telefónico es obligatorio.' });
    else if (telefono.length !== 10) errores.push({ field: 'telefono', message: 'El número telefónico debe tener 10 dígitos.' });

    if (!fecha) errores.push({ field: 'fechaNacimiento', message: 'La fecha de nacimiento es obligatoria.' });
    else {
      const error = validarFecha(fecha);
      if (error) errores.push({ field: 'fechaNacimiento', message: error });
    }

    if (!correo) errores.push({ field: 'correo', message: 'El correo institucional es obligatorio.' });
    else if (!isUadyEmail(correo)) errores.push({ field: 'correo', message: 'El correo debe terminar en @correo.uady.mx o @uady.mx.' });

    if (!cedula) errores.push({ field: 'cedula', message: 'La cédula profesional es obligatoria.' });
    else if (!/^\d{7,8}$/.test(cedula)) errores.push({ field: 'cedula', message: 'La cédula profesional debe tener 7 u 8 dígitos.' });

    return errores;
  }

  // --- Valores ---

  function rellenar(t: Terapeuta): void {
    input('nombre').value = t.nombre;
    input('telefono').value = formatearTelefonoLocal(t.telefono);
    input('fechaNacimiento').value = formatearFecha(t.fechaNacimiento);
    input('correo').value = t.correo;
    input('cedula').value = t.cedula;
    actualizarContador();
    fotoRaiz.dispatchEvent(new CustomEvent('foto:actual', { detail: urlFoto(t) }));
  }

  /** Huella de los valores actuales, para detectar cambios sin guardar. */
  function huella(): string {
    const foto = input('foto').files?.[0];
    return JSON.stringify([
      ...CAMPOS_TEXTO.map((c) => input(c).value.trim()),
      foto ? `${foto.name}:${foto.size}:${foto.lastModified}` : '',
      fotoRaiz.dataset.quitar ?? '',
    ]);
  }

  function construirDatos(): FormData {
    const datos = new FormData();
    CAMPOS_TEXTO.forEach((c) => datos.append(c, input(c).value.trim()));
    const foto = input('foto').files?.[0];
    if (foto) datos.append('foto', foto);
    else if (fotoRaiz.dataset.quitar === '1') datos.append('quitarFoto', '1');
    return datos;
  }

  function setCargando(cargando: boolean): void {
    submitBtn.disabled = cargando;
    submitBtn.textContent = cargando ? 'Guardando…' : textoGuardar;
  }

  /**
   * Valida y envía. Devuelve el terapeuta guardado, o null si hubo errores (ya mostrados).
   * RNF 2.2.7: ante cualquier fallo el formulario conserva lo capturado, incluida la foto.
   */
  async function enviar(metodo: 'POST' | 'PUT', ruta: string): Promise<Terapeuta | null> {
    limpiarErrores();
    const errores = validar();
    if (errores.length > 0) {
      mostrarErrores(errores);
      return null;
    }

    setCargando(true);
    try {
      const response = await fetch(`${API_URL}${ruta}`, { method: metodo, credentials: 'include', body: construirDatos() });
      const body = await response.json().catch(() => null);
      if (response.ok) return body.terapeuta as Terapeuta;

      if (response.status === 401) {
        mostrarMensaje('Tu sesión expiró. Inicia sesión de nuevo en otra pestaña y vuelve a intentar; tus datos siguen aquí.', 'error');
      } else if (body?.errors?.length) {
        mostrarErrores(body.errors);
      } else {
        mostrarMensaje(body?.error ?? 'No se pudo guardar. Intenta de nuevo.', 'error');
      }
    } catch {
      mostrarMensaje('No se pudo conectar con el servidor. Tus datos siguen en el formulario; intenta de nuevo.', 'error');
    } finally {
      setCargando(false);
    }
    return null;
  }

  return { form, fotoRaiz, rellenar, huella, enviar, mostrarMensaje };
}
