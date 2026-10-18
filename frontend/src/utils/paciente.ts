import { API_URL, pedirApi as pedir } from './sesion';
import { formatearFecha, formatearTamano, formatearTelefonoLocal, mascaraFecha } from './formato';

export { formatearTelefono, formatearFecha, formatearFechaHora, formatearTamano } from './formato';

export interface ArchivoPaciente {
  id: number;
  nombre: string;
  tipo: 'pdf' | 'jpg' | 'png';
  /** Bytes */
  tamano: number;
  subidoEn: string;
}

export interface Paciente {
  id: number;
  nombre: string;
  curp: string;
  sexo: 'M' | 'F' | 'O';
  /** ISO aaaa-mm-dd */
  fechaNacimiento: string;
  telefono: string;
  activo: boolean;
  fechaBaja: string | null;
  fechaRegistro: string;
  archivos: ArchivoPaciente[];
}

export interface PatientSearchItem {
  id: number;
  nombre: string;
  curpUltimos4: string;
  telefonoUltimos4: string;
  activo: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos';
export type OrdenFiltro = 'nombre' | 'registro';

export const SEXOS: Record<Paciente['sexo'], string> = { F: 'Femenino', M: 'Masculino', O: 'Otro' };

// --- Formatos de presentación ---

/** 12 → "#P-0012" */
export function formatearId(id: number): string {
  return `#P-${String(id).padStart(4, '0')}`;
}

export function urlArchivo(idPaciente: number, archivo: Pick<ArchivoPaciente, 'id'>): string {
  return `${API_URL}/pacientes/${idPaciente}/archivos/${archivo.id}`;
}

// --- API ---

/** RF 3.2.1: listado general con filtros de estado y orden. */
export async function listarPacientes(filtros: { estado: EstadoFiltro; orden: OrdenFiltro }): Promise<Paciente[]> {
  const params = new URLSearchParams({ estado: filtros.estado, orden: filtros.orden });
  const { response, body } = await pedir(`/pacientes?${params}`);
  if (!response.ok) throw new Error(`GET /pacientes respondió ${response.status}`);
  return body.pacientes;
}

/** Búsqueda rápida por nombre, CURP o teléfono; si la consulta está vacía, no hace petición. */
export async function buscarPacientes(consulta: string): Promise<PatientSearchItem[]> {
  const q = consulta.trim();
  if (!q) return [];

  const { response, body } = await pedir(`/pacientes?${new URLSearchParams({ q })}`);
  if (!response.ok) throw new Error(`GET /pacientes respondió ${response.status}`);
  if (!body || !Array.isArray(body.pacientes)) {
    throw new Error('GET /pacientes devolvió una respuesta inválida');
  }
  return body.pacientes;
}

/** Devuelve null si el paciente no existe. */
export async function obtenerPaciente(id: string | null): Promise<Paciente | null> {
  if (!id || !/^\d+$/.test(id)) return null;
  const { response, body } = await pedir(`/pacientes/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET /pacientes/${id} respondió ${response.status}`);
  return body.paciente;
}

/** RF 3.3.1: baja lógica o reactivación. */
export async function cambiarEstado(id: number, activo: boolean): Promise<Paciente> {
  const { response, body } = await pedir(`/pacientes/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  });
  if (!response.ok) throw new Error(body?.error ?? 'No se pudo cambiar el estado del paciente.');
  return body.paciente;
}

// --- Formulario de registro / edición (components/FormularioPaciente.astro) ---

export const CAMPOS = ['nombre_completo', 'curp', 'sexo', 'fecha_nacimiento', 'telefono', 'archivos'] as const;
export type Campo = (typeof CAMPOS)[number];
const CAMPOS_TEXTO = CAMPOS.filter((c) => c !== 'archivos');

// Deben coincidir con backend/src/utils/archivo.js y backend/src/routes/paciente.routes.js.
const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png'];
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png'];
const ARCHIVO_MAX_BYTES = 5 * 1024 * 1024;
const ARCHIVOS_MAX = 10;
const EDAD_MINIMA = 7;
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;

function validarFecha(valor: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!match) return 'Formato de fecha inválido. Usa dd/mm/aaaa.';
  const [dia, mes, anio] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return 'Formato de fecha inválido. Usa dd/mm/aaaa.';
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (fecha >= hoy) return 'La fecha de nacimiento debe ser anterior a la fecha actual.';

  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)) edad -= 1;
  if (edad < EDAD_MINIMA) return `El paciente debe tener al menos ${EDAD_MINIMA} años cumplidos.`;
  return null;
}

/** Primera barrera en cliente; el backend vuelve a validar el contenido real de cada archivo. */
function errorDeArchivo(archivo: File): string | null {
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  if (!TIPOS.includes(archivo.type) && !EXTENSIONES.includes(extension)) {
    return `El archivo "${archivo.name}" no es un PDF, JPG o PNG válido.`;
  }
  if (archivo.size > ARCHIVO_MAX_BYTES) return 'Los archivos no pueden pesar más de 5 MB.';
  return null;
}

/**
 * Conecta el formulario de components/FormularioPaciente.astro: máscaras, contador, adjuntos,
 * validación en cliente (mismas reglas y mensajes que backend/src/validators/paciente.validators.js),
 * errores por campo y envío. RF 3.1.1-3.1.12, RF 3.2.4-3.2.6.
 * `exigirArchivo`: el registro requiere al menos un adjunto; la edición solo impide quitar el último.
 */
export function iniciarFormulario({ exigirArchivo }: { exigirArchivo: boolean }) {
  const form = document.getElementById('paciente-form') as HTMLFormElement;
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  const formMessage = document.getElementById('form-message') as HTMLElement;
  const zona = document.getElementById('archivos-zona') as HTMLElement;
  const inputArchivos = document.getElementById('archivos') as HTMLInputElement;
  const listaArchivos = document.getElementById('archivos-lista') as HTMLUListElement;
  const textoGuardar = submitBtn.textContent?.trim() ?? 'Guardar';
  const control = (campo: Exclude<Campo, 'archivos'>) => document.getElementById(campo) as HTMLInputElement | HTMLSelectElement;

  let nuevos: File[] = [];
  let existentes: ArchivoPaciente[] = [];
  let idPaciente: number | null = null;
  const quitados = new Set<number>();

  // --- Máscaras de entrada ---

  const contador = document.getElementById('nombre_completo-contador');
  const actualizarContador = () => {
    if (contador) contador.textContent = `${control('nombre_completo').value.length} / 50`;
  };
  control('nombre_completo').addEventListener('input', actualizarContador);

  control('curp').addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
  });

  control('telefono').addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    target.value = formatearTelefonoLocal(target.value);
  });

  control('fecha_nacimiento').addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    target.value = mascaraFecha(target.value);
  });

  // --- Errores ---

  function mostrarError(campo: string, mensaje: string | null): void {
    const el = document.getElementById(`${campo}-error`);
    if (el) {
      el.textContent = mensaje ?? '';
      el.classList.toggle('hidden', !mensaje);
    }
    const objetivo = campo === 'archivos' ? zona : document.getElementById(campo);
    if (objetivo) {
      if (mensaje) objetivo.setAttribute('aria-invalid', 'true');
      else objetivo.removeAttribute('aria-invalid');
    }
  }

  CAMPOS_TEXTO.forEach((campo) => {
    const evento = campo === 'sexo' ? 'change' : 'input';
    control(campo).addEventListener(evento, () => mostrarError(campo, null));
  });

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
    if (primero?.field === 'archivos') zona.focus();
    else if (primero) control(primero.field as Exclude<Campo, 'archivos'>).focus();
    else if (errores[0]) mostrarMensaje(errores[0].message, 'error');
  }

  const conservados = () => existentes.filter((a) => !quitados.has(a.id));

  function validar(): FieldError[] {
    const errores: FieldError[] = [];
    const nombre = control('nombre_completo').value.trim();
    const curp = control('curp').value.trim().toUpperCase();
    const sexo = control('sexo').value;
    const fecha = control('fecha_nacimiento').value.trim();
    const telefono = control('telefono').value.replace(/\D/g, '');

    if (!nombre) errores.push({ field: 'nombre_completo', message: 'El nombre completo es obligatorio.' });
    else if (nombre.length > 50) errores.push({ field: 'nombre_completo', message: 'El nombre completo no puede exceder 50 caracteres.' });

    if (!curp) errores.push({ field: 'curp', message: 'La CURP es obligatoria.' });
    else if (!CURP_REGEX.test(curp)) errores.push({ field: 'curp', message: 'Ingresa una CURP oficial válida de 18 caracteres.' });

    if (!sexo) errores.push({ field: 'sexo', message: 'El sexo del paciente es obligatorio.' });

    if (!fecha) errores.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento es obligatoria.' });
    else {
      const error = validarFecha(fecha);
      if (error) errores.push({ field: 'fecha_nacimiento', message: error });
    }

    if (!telefono) errores.push({ field: 'telefono', message: 'El teléfono es obligatorio.' });
    else if (telefono.length !== 10) errores.push({ field: 'telefono', message: 'El teléfono debe contener 10 dígitos.' });

    const total = conservados().length + nuevos.length;
    if (exigirArchivo && nuevos.length === 0) {
      errores.push({ field: 'archivos', message: 'Debes adjuntar al menos un archivo (PDF, JPG o PNG).' });
    } else if (!exigirArchivo && quitados.size > 0 && total === 0) {
      errores.push({ field: 'archivos', message: 'El paciente debe conservar al menos un archivo adjunto.' });
    }

    return errores;
  }

  // --- Adjuntos ---

  function elementoArchivo(nombre: string, detalle: string, etiquetaQuitar: string, alQuitar: () => void, href?: string): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'flex items-center justify-between gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg';

    const info = document.createElement('div');
    info.className = 'flex items-center gap-3 min-w-0';
    const tipo = document.createElement('span');
    const esPdf = nombre.toLowerCase().endsWith('.pdf');
    tipo.className = `shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${esPdf ? 'bg-rose-100 text-rose-700' : 'bg-[#CCFBF1] text-[#0F766E]'}`;
    tipo.textContent = esPdf ? 'PDF' : 'IMG';
    const textos = document.createElement('div');
    textos.className = 'flex flex-col min-w-0';
    const titulo = document.createElement(href ? 'a' : 'span');
    titulo.className = `truncate text-sm font-semibold text-[#0F172A] ${href ? 'hover:underline' : ''}`;
    titulo.textContent = nombre;
    titulo.title = nombre;
    if (href && titulo instanceof HTMLAnchorElement) titulo.href = href;
    const sub = document.createElement('span');
    sub.className = 'text-[11px] text-[#64748B]';
    sub.textContent = detalle;
    textos.append(titulo, sub);
    info.append(tipo, textos);

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'shrink-0 px-2.5 py-1.5 rounded-md text-xs font-semibold text-[#64748B] hover:text-red-600 hover:bg-red-50 cursor-pointer';
    quitar.textContent = 'Quitar';
    quitar.setAttribute('aria-label', etiquetaQuitar);
    quitar.addEventListener('click', alQuitar);

    item.append(info, quitar);
    return item;
  }

  function pintarArchivos(): void {
    const items = [
      ...conservados().map((a) =>
        elementoArchivo(
          a.nombre,
          `${formatearTamano(a.tamano)} · guardado`,
          `Quitar ${a.nombre}`,
          () => {
            quitados.add(a.id);
            pintarArchivos();
          },
          idPaciente ? urlArchivo(idPaciente, a) : undefined
        )
      ),
      ...nuevos.map((archivo, i) =>
        elementoArchivo(archivo.name, `${formatearTamano(archivo.size)} · nuevo`, `Quitar ${archivo.name}`, () => {
          nuevos.splice(i, 1);
          pintarArchivos();
        })
      ),
    ];
    listaArchivos.replaceChildren(...items);
    listaArchivos.classList.toggle('hidden', items.length === 0);
    listaArchivos.classList.toggle('flex', items.length > 0);
  }

  function agregarArchivos(archivos: File[]): void {
    mostrarError('archivos', null);
    for (const archivo of archivos) {
      const error = errorDeArchivo(archivo);
      if (error) {
        mostrarError('archivos', error);
        continue;
      }
      if (nuevos.length >= ARCHIVOS_MAX) {
        mostrarError('archivos', `No puedes adjuntar más de ${ARCHIVOS_MAX} archivos a la vez.`);
        break;
      }
      const repetido = nuevos.some((f) => f.name === archivo.name && f.size === archivo.size && f.lastModified === archivo.lastModified);
      if (!repetido) nuevos.push(archivo);
    }
    inputArchivos.value = ''; // Permite volver a elegir un archivo que se quitó.
    pintarArchivos();
  }

  zona.addEventListener('click', () => inputArchivos.click());
  zona.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputArchivos.click();
    }
  });
  inputArchivos.addEventListener('change', () => agregarArchivos(Array.from(inputArchivos.files ?? [])));

  let arrastres = 0;
  const resaltar = (activo: boolean) => zona.classList.toggle('border-[#0D9488]', activo);
  zona.addEventListener('dragenter', (e) => {
    e.preventDefault();
    arrastres += 1;
    resaltar(true);
  });
  zona.addEventListener('dragover', (e) => e.preventDefault());
  zona.addEventListener('dragleave', () => {
    arrastres = Math.max(0, arrastres - 1);
    if (arrastres === 0) resaltar(false);
  });
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    arrastres = 0;
    resaltar(false);
    agregarArchivos(Array.from(e.dataTransfer?.files ?? []));
  });

  // --- Valores ---

  function rellenar(p: Paciente): void {
    idPaciente = p.id;
    control('nombre_completo').value = p.nombre;
    control('curp').value = p.curp;
    control('sexo').value = p.sexo;
    control('fecha_nacimiento').value = formatearFecha(p.fechaNacimiento);
    control('telefono').value = formatearTelefonoLocal(p.telefono);
    existentes = p.archivos;
    quitados.clear();
    nuevos = [];
    actualizarContador();
    pintarArchivos();
  }

  /** Huella de los valores actuales, para detectar cambios sin guardar. */
  function huella(): string {
    return JSON.stringify([
      ...CAMPOS_TEXTO.map((c) => control(c).value.trim()),
      nuevos.map((f) => `${f.name}:${f.size}:${f.lastModified}`),
      [...quitados].sort(),
    ]);
  }

  function construirDatos(): FormData {
    const datos = new FormData();
    datos.append('nombre_completo', control('nombre_completo').value.trim());
    datos.append('curp', control('curp').value.trim().toUpperCase());
    datos.append('sexo', control('sexo').value);
    datos.append('fecha_nacimiento', control('fecha_nacimiento').value.trim());
    datos.append('telefono', control('telefono').value.replace(/\D/g, ''));
    nuevos.forEach((archivo) => datos.append('archivos', archivo));
    quitados.forEach((id) => datos.append('quitarArchivos', String(id)));
    return datos;
  }

  function setCargando(cargando: boolean): void {
    submitBtn.disabled = cargando;
    submitBtn.textContent = cargando ? 'Guardando…' : textoGuardar;
  }

  /**
   * Valida y envía. Devuelve el paciente guardado, o null si hubo errores (ya mostrados).
   * RNF 3.2.6: ante cualquier fallo el formulario conserva lo capturado, incluidos los adjuntos.
   */
  async function enviar(metodo: 'POST' | 'PUT', ruta: string): Promise<Paciente | null> {
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
      if (response.ok) return body.paciente as Paciente;

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

  return { form, rellenar, huella, enviar, mostrarMensaje };
}
