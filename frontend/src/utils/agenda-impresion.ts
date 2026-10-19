import {
  agruparPor,
  diasSemana,
  fechaImpresion,
  horasJornada,
  obtenerAgenda,
  semanasMes,
  slotsJornada,
  tituloPeriodo,
  type Agenda,
  type FiltrosAgenda,
  type Vista,
} from './agenda';

const NOMBRE_VISTA: Record<Vista, string> = { dia: 'Diaria', semana: 'Semanal', mes: 'Mensual' };
const DIAS_CORTOS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase = '', texto?: string): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function th(texto: string, clase = '') {
  return el('th', `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[#0F172A] ${clase}`, texto);
}

function td(texto: string, clase = '') {
  return el('td', `px-3 py-1.5 text-[11px] align-top ${clase}`, texto);
}

/** RF 6.2.2: lapsos de 30 min de 07:00 a 17:00; una fila por cita, "Disponible" si no inicia ninguna. */
function hojaDia(agenda: Agenda): HTMLElement {
  const tabla = el('table', 'w-full border-collapse');
  const cab = el('tr', 'bg-white');
  cab.append(th('Hora', 'w-16'), th('Paciente'), th('Terapeuta'), th('Sala / Consultorio'));
  tabla.append(el('thead'), el('tbody'));
  tabla.tHead!.append(cab);
  const porHora = agruparPor(agenda.citas, (c) => c.horaInicio);
  for (const hora of slotsJornada()) {
    const citas = porHora.get(hora) ?? [];
    if (!citas.length) {
      const fila = el('tr', 'border-t border-[#E2E8F0]');
      fila.append(td(hora, 'text-[#64748B]'), td('Disponible', 'text-[#64748B]'), td('-', 'text-[#64748B]'), td('-', 'text-[#64748B]'));
      tabla.tBodies[0].append(fila);
      continue;
    }
    citas.forEach((cita, i) => {
      const fila = el('tr', 'border-t border-[#E2E8F0] bg-white');
      fila.append(
        td(i === 0 ? hora : '', 'font-bold text-[#0F172A]'),
        td(`${cita.paciente.nombre}${cita.estado === 'Vencida' ? ' (vencida)' : ''}`, 'font-bold text-[#0F172A]'),
        td(cita.terapeuta.nombre, 'text-[#334155]'),
        td(`${cita.sala.nombre} · ${cita.horaInicio}-${cita.horaFin}`, 'font-semibold text-[#0D9488]'),
      );
      tabla.tBodies[0].append(fila);
    });
  }
  return tabla;
}

function hojaSemana(agenda: Agenda): HTMLElement {
  const dias = diasSemana(agenda.fecha);
  const tabla = el('table', 'w-full border-collapse table-fixed');
  const cab = el('tr', 'bg-white');
  cab.append(th('Hora', 'w-14'), ...dias.map((f, i) => th(`${DIAS_CORTOS[i]} ${Number(f.slice(8))}`)));
  tabla.append(el('thead'), el('tbody'));
  tabla.tHead!.append(cab);
  const porCelda = agruparPor(agenda.citas, (c) => `${c.fecha} ${c.horaInicio.slice(0, 2)}`);
  for (const hora of horasJornada()) {
    const fila = el('tr', 'border-t border-[#E2E8F0]');
    fila.append(td(hora, 'font-bold text-[#334155]'));
    for (const fecha of dias) {
      const celda = td('', 'text-[#0F172A]');
      const citas = porCelda.get(`${fecha} ${hora.slice(0, 2)}`) ?? [];
      if (!citas.length) celda.append(el('span', 'text-[#94A3B8]', '-'));
      for (const c of citas) {
        const linea = el('div', 'leading-tight mb-1');
        linea.append(el('strong', '', `${c.horaInicio} ${c.paciente.nombre}`), el('span', 'block text-[10px] text-[#0D9488]', `${c.sala.nombre} · ${c.terapeuta.nombre}`));
        celda.append(linea);
      }
      fila.append(celda);
    }
    tabla.tBodies[0].append(fila);
  }
  return tabla;
}

function hojaMes(agenda: Agenda): HTMLElement {
  const mes = agenda.desde.slice(0, 7);
  const porDia = agruparPor(agenda.citas, (c) => c.fecha);
  const tabla = el('table', 'w-full border-collapse table-fixed');
  const cab = el('tr', 'bg-white');
  cab.append(...DIAS_CORTOS.map((d) => th(d)));
  tabla.append(el('thead'), el('tbody'));
  tabla.tHead!.append(cab);
  for (const semana of semanasMes(agenda.fecha)) {
    const fila = el('tr');
    for (const fecha of semana) {
      const delMes = fecha.slice(0, 7) === mes;
      const celda = td('', `h-20 border border-[#E2E8F0] ${delMes ? 'bg-white' : 'bg-[#F8FAFC]'}`);
      celda.append(el('div', `text-[11px] font-bold ${delMes ? 'text-[#0F172A]' : 'text-[#CBD5E1]'}`, String(Number(fecha.slice(8)))));
      if (delMes) {
        for (const c of porDia.get(fecha) ?? []) {
          celda.append(el('div', 'text-[9px] leading-tight text-[#334155]', `${c.horaInicio} ${c.paciente.nombre} (${c.sala.nombre})`));
        }
      }
      fila.append(celda);
    }
    tabla.tBodies[0].append(fila);
  }
  return tabla;
}

function construirHoja(agenda: Agenda, filtros: string[]): HTMLElement {
  const hoja = el('article', 'flex flex-col gap-4 text-[#0F172A]');
  const cab = el('header', 'flex items-start justify-between gap-4 pb-3 border-b border-[#E2E8F0]');
  const izq = el('div');
  izq.append(
    el('h3', 'text-[15px] font-bold text-[#006847]', `PsicoGestión UADY - Agenda ${NOMBRE_VISTA[agenda.vista]}`),
    el('p', 'text-[11px] text-[#475569]', 'Facultad de Psicología, Clínica de Asuntos Generales'),
  );
  if (filtros.length) izq.append(el('p', 'mt-1 text-[11px] font-semibold text-[#334155]', filtros.join(' · ')));
  const fecha = agenda.vista === 'dia' ? fechaImpresion(agenda.fecha) : tituloPeriodo(agenda.vista, agenda.fecha);
  cab.append(izq, el('p', 'text-[12px] font-semibold text-right', fecha));
  hoja.append(cab, agenda.vista === 'dia' ? hojaDia(agenda) : agenda.vista === 'semana' ? hojaSemana(agenda) : hojaMes(agenda));
  return hoja;
}

/**
 * RF 6.2.1–6.2.4: vista previa e impresión (carta) de la vista actual. La hoja se clona a un nodo hijo
 * directo de <body> para que `@media print` (global.css) oculte el resto de la app.
 */
export function iniciarImpresion(obtenerEstado: () => FiltrosAgenda, nombresFiltros: () => string[]) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialogo = $<HTMLDialogElement>('dialogo-impresion');
  const fecha = $<HTMLInputElement>('imprimir-fecha');
  const vistaPrevia = $('vista-previa');
  const imprimir = $<HTMLButtonElement>('btn-imprimir');
  let filtros: FiltrosAgenda = obtenerEstado();
  let hoja: HTMLElement | null = null;
  let consulta = 0;

  async function preparar() {
    const id = ++consulta;
    imprimir.disabled = true;
    vistaPrevia.replaceChildren(el('p', 'py-10 text-center text-sm text-[#64748B]', 'Generando vista previa…'));
    try {
      const agenda = await obtenerAgenda({ ...filtros, fecha: fecha.value || filtros.fecha });
      if (id !== consulta) return;
      hoja = construirHoja(agenda, nombresFiltros());
      vistaPrevia.replaceChildren(hoja);
      imprimir.disabled = false;
    } catch (err) {
      if (id !== consulta) return;
      vistaPrevia.replaceChildren(el('p', 'py-10 text-center text-sm text-red-600', err instanceof Error ? err.message : 'No se pudo generar la vista previa.'));
    }
  }

  $('btn-abrir-impresion').addEventListener('click', () => {
    filtros = obtenerEstado();
    fecha.value = filtros.fecha;
    $('imprimir-etiqueta').textContent = filtros.vista === 'dia' ? 'Fecha a imprimir:' : filtros.vista === 'semana' ? 'Semana que contiene:' : 'Mes que contiene:';
    dialogo.showModal();
    preparar();
  });
  fecha.addEventListener('change', () => { if (fecha.value) preparar(); });
  $('btn-cancelar-impresion').addEventListener('click', () => dialogo.close());

  imprimir.addEventListener('click', () => {
    if (!hoja) return;
    const area = el('div');
    area.id = 'area-impresion';
    area.append(hoja.cloneNode(true));
    const pagina = el('style');
    pagina.textContent = `@page { size: letter ${filtros.vista === 'dia' ? 'portrait' : 'landscape'}; margin: 12mm; }`;
    document.head.append(pagina);
    document.body.append(area);
    document.body.classList.add('imprimiendo');
    dialogo.close();
    const limpiar = () => {
      area.remove();
      pagina.remove();
      document.body.classList.remove('imprimiendo');
      window.removeEventListener('afterprint', limpiar);
    };
    window.addEventListener('afterprint', limpiar);
    window.print();
  });
}
