import { validateAgenda } from '../validators/agenda.validators.js';
import { HORA_INICIO_JORNADA, HORA_FIN_JORNADA, MINUTOS_BLOQUE } from '../validators/cita.validators.js';
import { agendaEntre } from '../services/cita.service.js';

export async function consultar(req, res, next) {
  const { errors, data } = validateAgenda(req.query);
  if (errors.length) return res.status(400).json({ errors });
  try {
    const citas = await agendaEntre(data);
    return res.json({
      vista: data.vista,
      fecha: data.fecha,
      desde: data.desde,
      hasta: data.hasta,
      jornada: { inicio: HORA_INICIO_JORNADA, fin: HORA_FIN_JORNADA, minutosBloque: MINUTOS_BLOQUE },
      citas,
    });
  } catch (err) {
    return next(err);
  }
}
