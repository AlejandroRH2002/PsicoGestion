// RF 5.1.14: aviso al paciente con nombre, terapeuta, folio, sala, fecha y hora.
// El paciente solo tiene teléfono registrado y aún no hay un canal (SMS/WhatsApp) contratado, así que
// por ahora el aviso solo se registra en el log. Sustituir el cuerpo de estas funciones al integrar
// el canal real; los llamadores ya las invocan después del COMMIT y no dependen de su resultado.

function describir(cita) {
  return `${cita.folio} · paciente ${cita.paciente.nombre} · terapeuta ${cita.terapeuta.nombre} · `
    + `sala ${cita.sala.nombre} · ${cita.fecha} ${cita.horaInicio}-${cita.horaFin} · ${cita.estado}`;
}

async function enviar(evento, cita) {
  try {
    console.info(`[notificador] ${evento}: ${describir(cita)}`);
  } catch (err) {
    // Un fallo al notificar nunca debe revertir ni ocultar una cita ya guardada.
    console.error(`[notificador] No se pudo notificar ${evento}: ${err.message}`);
  }
}

export function notificarCitaAgendada(cita) {
  return enviar('cita agendada', cita);
}

export function notificarCitaModificada(cita) {
  return enviar('cita modificada', cita);
}
