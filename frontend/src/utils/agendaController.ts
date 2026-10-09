import {
  listarCitasApi,
  HORARIOS_DIA,
  HORARIOS_SEMANA,
  NOMBRES_MESES,
  NOMBRES_DIAS_COMPLETO,
  formatFechaISO,
  getLunesDeSemana,
  type TipoVista,
  type Cita,
} from './citas';

export function inicializarAgenda(): void {
  // Estado activo
  const params = new URLSearchParams(window.location.search);
  const paramVista = params.get('vista');
  let vistaActual: TipoVista = (paramVista === 'dia' || paramVista === 'semana' || paramVista === 'mes')
    ? paramVista
    : 'mes';

  // Fecha seleccionada por defecto: 12 de Octubre de 2026 (fiel a los requerimientos)
  let fechaSeleccionada = new Date(2026, 9, 12);
  let citasCargadas: Cita[] = [];

  async function cargarCitasDesdeBackend(): Promise<void> {
    try {
      const res = await listarCitasApi({ limit: 100 });
      citasCargadas = (res.citas || []).map((c) => ({
        id: c.id,
        fecha: c.fecha,
        hora: c.horaInicio.slice(0, 5),
        duracion: '1h',
        paciente: c.paciente,
        pacienteMes: c.paciente,
        pacienteSemana: c.paciente,
        terapeuta: c.terapeuta,
        sala: c.sala,
        salaCorta: c.sala,
        estado: c.estado,
        folio: c.folio,
      }));
    } catch (e) {
      console.error('Error al cargar citas de la API:', e);
    }
  }

  // Referencias DOM
  const vistaTitulo = document.getElementById('vista-titulo');
  const vistaSubtitulo = document.getElementById('vista-subtitulo');
  const tabDia = document.getElementById('tab-dia');
  const tabSemana = document.getElementById('tab-semana');
  const tabMes = document.getElementById('tab-mes');
  const btnNavPrev = document.getElementById('btn-nav-prev');
  const btnNavNext = document.getElementById('btn-nav-next');
  const calendarHeaderLabel = document.getElementById('calendar-header-label');
  const diaHorarioLabel = document.getElementById('dia-horario-label');

  const seccionMes = document.getElementById('vista-mes');
  const seccionSemana = document.getElementById('vista-semana');
  const seccionDia = document.getElementById('vista-dia');

  const gridMes = document.getElementById('grid-mes');
  const semanaFilas = document.getElementById('semana-filas');
  const diaSlots = document.getElementById('dia-slots');

  // Modal elementos
  const modalImpresion = document.getElementById('modal-impresion');
  const btnAbrirImprimir = document.getElementById('btn-abrir-imprimir');
  const btnCerrarImprimir = document.getElementById('btn-cerrar-imprimir');
  const btnEjecutarImprimir = document.getElementById('btn-ejecutar-imprimir');
  const printFechaBadge = document.getElementById('print-fecha-badge');
  const printDocFecha = document.getElementById('print-doc-fecha');
  const printTableBody = document.getElementById('print-table-body');

  if (!vistaTitulo || !vistaSubtitulo || !tabDia || !tabSemana || !tabMes || !calendarHeaderLabel) {
    return;
  }

  function cambiarVista(nuevaVista: TipoVista): void {
    vistaActual = nuevaVista;

    const tabs = [
      { btn: tabDia, view: 'dia' },
      { btn: tabSemana, view: 'semana' },
      { btn: tabMes, view: 'mes' },
    ];

    tabs.forEach(({ btn, view }) => {
      if (!btn) return;
      const esActivo = view === nuevaVista;
      btn.setAttribute('aria-selected', esActivo ? 'true' : 'false');
      if (esActivo) {
        btn.className = 'view-tab-btn px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer bg-[#0D9488] text-white shadow-xs';
      } else {
        btn.className = 'view-tab-btn px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-[#334155] hover:text-[#0F172A] hover:bg-slate-50';
      }
    });

    seccionMes?.classList.toggle('hidden', nuevaVista !== 'mes');
    seccionSemana?.classList.toggle('hidden', nuevaVista !== 'semana');
    seccionDia?.classList.toggle('hidden', nuevaVista !== 'dia');
    diaHorarioLabel?.classList.toggle('hidden', nuevaVista !== 'dia');

    if (nuevaVista === 'mes') {
      vistaTitulo!.textContent = 'Agenda Mensual';
      vistaSubtitulo!.textContent = 'Ocupación del mes';
    } else if (nuevaVista === 'semana') {
      vistaTitulo!.textContent = 'Agenda Semanal';
      vistaSubtitulo!.textContent = 'Ocupación semanal de la clínica';
    } else {
      vistaTitulo!.textContent = 'Agenda del Día';
      vistaSubtitulo!.textContent = 'Gestión y ocupación de consultorios hoy';
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('vista', nuevaVista);
    window.history.replaceState({}, '', currentUrl);

    renderizarCalendario();
  }

  function renderizarCabeceraFecha(): void {
    if (!calendarHeaderLabel) return;
    const mesNombre = NOMBRES_MESES[fechaSeleccionada.getMonth()];
    const anio = fechaSeleccionada.getFullYear();

    if (vistaActual === 'mes') {
      calendarHeaderLabel.textContent = `${mesNombre} ${anio}`;
    } else if (vistaActual === 'semana') {
      const lunes = getLunesDeSemana(fechaSeleccionada);
      const viernes = new Date(lunes);
      viernes.setDate(viernes.getDate() + 4);

      if (lunes.getMonth() === viernes.getMonth()) {
        calendarHeaderLabel.textContent = `Semana del ${lunes.getDate()} - ${viernes.getDate()} de ${NOMBRES_MESES[lunes.getMonth()]} ${lunes.getFullYear()}`;
      } else {
        calendarHeaderLabel.textContent = `Semana del ${lunes.getDate()} ${NOMBRES_MESES[lunes.getMonth()]} - ${viernes.getDate()} ${NOMBRES_MESES[viernes.getMonth()]} ${lunes.getFullYear()}`;
      }
    } else {
      const nombreDia = NOMBRES_DIAS_COMPLETO[fechaSeleccionada.getDay()];
      calendarHeaderLabel.textContent = `${nombreDia}, ${fechaSeleccionada.getDate()} de ${mesNombre} ${anio}`;
    }
  }

  function renderizarVistaMes(): void {
    if (!gridMes) return;
    gridMes.innerHTML = '';
    const anio = fechaSeleccionada.getFullYear();
    const mes = fechaSeleccionada.getMonth();

    const primerDia = new Date(anio, mes, 1);
    let diaSemanaPrimerDia = primerDia.getDay() - 1;
    if (diaSemanaPrimerDia === -1) diaSemanaPrimerDia = 6;

    const ultimoDia = new Date(anio, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const ultimoDiaMesAnterior = new Date(anio, mes, 0).getDate();

    const totalCasillas = (diaSemanaPrimerDia + diasEnMes) > 35 ? 42 : 35;

    for (let i = 0; i < totalCasillas; i++) {
      const celda = document.createElement('div');
      celda.className = 'min-h-[105px] md:min-h-[115px] p-2 md:p-2.5 rounded-xl border border-[#E2E8F0] bg-white flex flex-col justify-between transition-colors hover:border-[#0D9488]/50 hover:shadow-2xs cursor-pointer select-none';

      let numeroDia: number;
      let esMesActual = true;
      let fechaCelda: Date;

      if (i < diaSemanaPrimerDia) {
        numeroDia = ultimoDiaMesAnterior - diaSemanaPrimerDia + i + 1;
        esMesActual = false;
        fechaCelda = new Date(anio, mes - 1, numeroDia);
      } else if (i >= diaSemanaPrimerDia + diasEnMes) {
        numeroDia = i - (diaSemanaPrimerDia + diasEnMes) + 1;
        esMesActual = false;
        fechaCelda = new Date(anio, mes + 1, numeroDia);
      } else {
        numeroDia = i - diaSemanaPrimerDia + 1;
        fechaCelda = new Date(anio, mes, numeroDia);
      }

      const fechaIso = formatFechaISO(fechaCelda);
      const citasDelDia = citasCargadas.filter(c => c.fecha === fechaIso);

      if (!esMesActual) {
        celda.classList.remove('bg-white');
        celda.classList.add('bg-slate-50/40', 'border-slate-100');
      }

      const celdaTop = document.createElement('div');
      celdaTop.className = 'flex items-center justify-between';

      const numSpan = document.createElement('span');
      numSpan.className = `text-xs font-bold ${esMesActual ? 'text-[#334155]' : 'text-slate-300'}`;
      numSpan.textContent = `${numeroDia}`;
      celdaTop.appendChild(numSpan);

      if (citasDelDia.length > 0) {
        const dot = document.createElement('span');
        dot.className = 'size-1.5 rounded-full bg-[#0D9488]';
        dot.setAttribute('aria-hidden', 'true');
        celdaTop.appendChild(dot);
      }

      celda.appendChild(celdaTop);

      const citasContainer = document.createElement('div');
      citasContainer.className = 'flex flex-col gap-1 mt-1 overflow-hidden';

      citasDelDia.forEach(cita => {
        const pill = document.createElement('div');
        pill.className = 'bg-[#DCFCE7] text-[#006847] text-[10px] md:text-[11px] font-semibold px-1.5 md:px-2 py-0.5 rounded-md truncate border border-emerald-200/50 hover:bg-[#bbf7d0] transition-colors';
        pill.textContent = cita.pacienteMes;
        pill.title = `${cita.hora} - ${cita.paciente} (${cita.sala})`;
        citasContainer.appendChild(pill);
      });

      celda.appendChild(citasContainer);

      celda.addEventListener('click', () => {
        fechaSeleccionada = new Date(fechaCelda);
        cambiarVista('dia');
      });

      gridMes.appendChild(celda);
    }
  }

  function renderizarVistaSemana(): void {
    if (!semanaFilas) return;
    semanaFilas.innerHTML = '';
    const lunes = getLunesDeSemana(fechaSeleccionada);

    const diasSemana = ['lun', 'mar', 'mie', 'jue', 'vie'];
    const fechasSemana: { iso: string; date: Date }[] = [];

    diasSemana.forEach((diaClave, index) => {
      const diaFecha = new Date(lunes);
      diaFecha.setDate(lunes.getDate() + index);
      const iso = formatFechaISO(diaFecha);
      fechasSemana.push({ iso, date: diaFecha });

      const headerEl = document.getElementById(`col-header-${diaClave}`);
      if (headerEl) {
        const numeroEl = headerEl.querySelector('span:nth-child(2)');
        if (numeroEl) numeroEl.textContent = `${diaFecha.getDate()}`;

        headerEl.onclick = () => {
          fechaSeleccionada = new Date(diaFecha);
          cambiarVista('dia');
        };
        headerEl.classList.add('cursor-pointer', 'hover:border-[#0D9488]/40', 'transition-colors');
      }
    });

    HORARIOS_SEMANA.forEach(hora => {
      const fila = document.createElement('div');
      fila.className = 'grid grid-cols-[60px_repeat(5,1fr)] gap-2.5 items-center';

      const horaCol = document.createElement('div');
      horaCol.className = 'text-xs sm:text-sm font-bold text-[#0F172A] text-left select-none';
      horaCol.textContent = hora;
      fila.appendChild(horaCol);

      fechasSemana.forEach(({ iso }) => {
        const cita = citasCargadas.find(c => c.fecha === iso && c.hora.startsWith(hora.split(':')[0]));

        const celda = document.createElement('div');
        if (cita) {
          celda.className = 'border border-teal-200 bg-[#CCFBF1] rounded-xl p-2.5 min-h-[56px] flex flex-col justify-center gap-0.5 shadow-2xs hover:brightness-95 transition-all cursor-pointer';
          celda.innerHTML = `
            <span class="text-xs font-bold text-slate-900 leading-tight truncate">${cita.pacienteSemana}</span>
            <span class="text-[11px] font-semibold text-[#0D9488] leading-tight truncate">${cita.salaCorta}</span>
          `;
          celda.addEventListener('click', () => {
            fechaSeleccionada = new Date(iso + 'T00:00:00');
            cambiarVista('dia');
          });
        } else {
          celda.className = 'border border-[#E2E8F0]/80 rounded-xl min-h-[56px] flex items-center justify-center text-slate-300 text-sm font-light bg-white hover:bg-slate-50/50 transition-colors select-none';
          celda.textContent = '-';
        }
        fila.appendChild(celda);
      });

      semanaFilas.appendChild(fila);
    });
  }

  function renderizarVistaDia(): void {
    if (!diaSlots) return;
    diaSlots.innerHTML = '';
    const fechaIso = formatFechaISO(fechaSeleccionada);

    HORARIOS_DIA.forEach(hora => {
      const cita = citasCargadas.find(c => c.fecha === fechaIso && c.hora === hora);

      const slotRow = document.createElement('div');
      slotRow.className = 'flex items-start gap-4 py-2 sm:py-2.5';

      const horaLabel = document.createElement('div');
      horaLabel.className = 'w-14 sm:w-16 shrink-0 text-sm font-bold text-[#0F172A] pt-3.5 select-none';
      horaLabel.textContent = hora;
      slotRow.appendChild(horaLabel);

      const slotBox = document.createElement('div');
      slotBox.className = 'flex-1 min-w-0';

      if (cita) {
        slotBox.innerHTML = `
          <div class="w-full border border-[#0D9488]/40 bg-white rounded-xl p-3.5 sm:p-4 shadow-2xs hover:border-[#0D9488] transition-colors flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold text-[#0F172A] truncate">${cita.paciente}</span>
              <span class="text-[11px] font-bold text-[#006847] bg-[#DCFCE7] px-2 py-0.5 rounded-md shrink-0">${cita.duracion}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-[#64748B] flex-wrap">
              <span>Tutor/Terapeuta: ${cita.terapeuta}</span>
              <span class="text-slate-300">•</span>
              <span class="font-semibold text-[#0D9488]">${cita.sala}</span>
            </div>
          </div>
        `;
      } else {
        slotBox.innerHTML = `
          <div class="w-full border border-dashed border-[#E2E8F0] rounded-xl px-4 py-3 bg-white text-xs text-[#94A3B8] font-normal flex items-center select-none">
            Espacio disponible para cita
          </div>
        `;
      }

      slotRow.appendChild(slotBox);
      diaSlots.appendChild(slotRow);
    });
  }

  function renderizarCalendario(): void {
    renderizarCabeceraFecha();
    if (vistaActual === 'mes') {
      renderizarVistaMes();
    } else if (vistaActual === 'semana') {
      renderizarVistaSemana();
    } else {
      renderizarVistaDia();
    }
  }

  function abrirModalImpresion(): void {
    if (!modalImpresion || !printFechaBadge || !printDocFecha || !printTableBody) return;
    const fechaIso = formatFechaISO(fechaSeleccionada);
    const diaNum = fechaSeleccionada.getDate();
    const mesNombre = NOMBRES_MESES[fechaSeleccionada.getMonth()];
    const mesCorto = mesNombre.substring(0, 3);
    const anio = fechaSeleccionada.getFullYear();
    const nombreDia = NOMBRES_DIAS_COMPLETO[fechaSeleccionada.getDay()];

    printFechaBadge.textContent = `${diaNum} / ${mesNombre} / ${anio}`;
    printDocFecha.textContent = `${nombreDia}, ${diaNum} ${mesCorto} ${anio}`;

    printTableBody.innerHTML = '';
    HORARIOS_DIA.forEach(hora => {
      const cita = citasCargadas.find(c => c.fecha === fechaIso && c.hora === hora);
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 last:border-0 hover:bg-slate-50/50';

      if (cita) {
        tr.innerHTML = `
          <td class="py-2.5 px-3 font-bold text-[#0F172A] whitespace-nowrap">${hora}</td>
          <td class="py-2.5 px-3 font-bold text-[#0F172A]">${cita.paciente}</td>
          <td class="py-2.5 px-3 text-[#334155]">${cita.terapeuta}</td>
          <td class="py-2.5 px-3 font-semibold text-[#0D9488] whitespace-nowrap">${cita.sala}</td>
        `;
      } else {
        tr.innerHTML = `
          <td class="py-2.5 px-3 font-semibold text-slate-500 whitespace-nowrap">${hora}</td>
          <td class="py-2.5 px-3 text-[#94A3B8]">Disponible</td>
          <td class="py-2.5 px-3 text-slate-400">-</td>
          <td class="py-2.5 px-3 text-slate-400">-</td>
        `;
      }
      printTableBody.appendChild(tr);
    });

    modalImpresion.classList.remove('hidden');
    modalImpresion.classList.add('flex');
  }

  function cerrarModalImpresion(): void {
    modalImpresion?.classList.add('hidden');
    modalImpresion?.classList.remove('flex');
  }

  // Event Listeners
  tabDia?.addEventListener('click', () => cambiarVista('dia'));
  tabSemana?.addEventListener('click', () => cambiarVista('semana'));
  tabMes?.addEventListener('click', () => cambiarVista('mes'));

  btnNavPrev?.addEventListener('click', () => {
    if (vistaActual === 'mes') {
      fechaSeleccionada.setMonth(fechaSeleccionada.getMonth() - 1);
    } else if (vistaActual === 'semana') {
      fechaSeleccionada.setDate(fechaSeleccionada.getDate() - 7);
    } else {
      fechaSeleccionada.setDate(fechaSeleccionada.getDate() - 1);
    }
    renderizarCalendario();
  });

  btnNavNext?.addEventListener('click', () => {
    if (vistaActual === 'mes') {
      fechaSeleccionada.setMonth(fechaSeleccionada.getMonth() + 1);
    } else if (vistaActual === 'semana') {
      fechaSeleccionada.setDate(fechaSeleccionada.getDate() + 7);
    } else {
      fechaSeleccionada.setDate(fechaSeleccionada.getDate() + 1);
    }
    renderizarCalendario();
  });

  btnAbrirImprimir?.addEventListener('click', abrirModalImpresion);
  btnCerrarImprimir?.addEventListener('click', cerrarModalImpresion);
  btnEjecutarImprimir?.addEventListener('click', () => {
    window.print();
  });

  modalImpresion?.addEventListener('click', (e) => {
    if (e.target === modalImpresion) {
      cerrarModalImpresion();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalImpresion?.classList.contains('hidden')) {
      cerrarModalImpresion();
    }
  });

  // Inicialización asíncrona conectada al backend
  cambiarVista(vistaActual);
  void cargarCitasDesdeBackend().then(() => {
    renderizarCalendario();
  });
}
