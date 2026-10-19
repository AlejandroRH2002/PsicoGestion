import { sendMail } from './mailer.js';

// RF 5.1.14: confirmación al paciente con nombre, fecha y hora, folio, terapeuta y sala, enviada al correo
// registrado en su expediente (paciente.correo, opcional). Sin SMTP configurado en desarrollo, el mailer
// imprime el correo en consola en lugar de enviarlo.
// Los llamadores invocan estas funciones después del COMMIT: un fallo al notificar nunca revierte ni oculta
// una cita ya guardada, solo se informa en el resultado.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaLarga(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const semana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return `${DIAS[semana]} ${dia} de ${MESES[mes - 1]} de ${anio}`;
}

export function redactarConfirmacion(evento, cita) {
  const asunto = evento === 'agendada'
    ? `Confirmación de cita ${cita.folio} - PsicoGestión UADY`
    : `Actualización de cita ${cita.folio} - PsicoGestión UADY`;
  const intro = evento === 'agendada'
    ? 'tu cita en la Clínica de la Facultad de Psicología de la UADY quedó agendada.'
    : 'tu cita en la Clínica de la Facultad de Psicología de la UADY fue modificada. Estos son los datos vigentes:';
  const texto = [
    `Hola, ${cita.paciente.nombre}:`,
    '',
    intro,
    '',
    `Folio: ${cita.folio}`,
    `Fecha: ${fechaLarga(cita.fecha)}`,
    `Hora: ${cita.horaInicio} a ${cita.horaFin}`,
    `Terapeuta: ${cita.terapeuta.nombre}`,
    `Sala: ${cita.sala.nombre}`,
    '',
    'Si necesitas cambiar o cancelar tu cita, comunícate con la secretaría de la clínica indicando tu folio.',
  ].join('\n');
  return { asunto, texto };
}

/**
 * Devuelve { enviada: true, destino } o { enviada: false, motivo } con motivo 'sin_correo', 'no_aplica'
 * (la cita ya no está Pendiente) o 'error'. Nunca lanza.
 */
async function enviar(evento, cita, correo) {
  if (cita.estado !== 'Pendiente') return { enviada: false, motivo: 'no_aplica' };
  if (!correo) {
    console.info(`[notificador] cita ${evento} ${cita.folio}: el paciente no tiene correo registrado.`);
    return { enviada: false, motivo: 'sin_correo' };
  }
  try {
    const { asunto, texto } = redactarConfirmacion(evento, cita);
    await sendMail({ to: correo, subject: asunto, text: texto });
    return { enviada: true, destino: correo };
  } catch (err) {
    console.error(`[notificador] No se pudo notificar la cita ${evento} ${cita.folio}: ${err.message}`);
    return { enviada: false, motivo: 'error' };
  }
}

export function notificarCitaAgendada(cita, correo) {
  return enviar('agendada', cita, correo);
}

export function notificarCitaModificada(cita, correo) {
  return enviar('modificada', cita, correo);
}
