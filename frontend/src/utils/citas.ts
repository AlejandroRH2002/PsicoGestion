export interface Cita {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  duracion: string;
  paciente: string;
  pacienteMes: string;
  pacienteSemana: string;
  terapeuta: string;
  sala: string;
  salaCorta: string;
}

export type TipoVista = 'dia' | 'semana' | 'mes';

export const CITAS_MOCK: Cita[] = [
  {
    id: '1',
    fecha: '2026-10-12',
    hora: '08:00',
    duracion: '1h',
    paciente: 'María Josefina Pech',
    pacienteMes: 'M. Josefina Pech',
    pacienteSemana: 'M. Josefina Pech',
    terapeuta: 'Mtra. Sofía May',
    sala: 'Consultorio A-1',
    salaCorta: 'Cons. A-1',
  },
  {
    id: '2',
    fecha: '2026-10-12',
    hora: '10:00',
    duracion: '1h',
    paciente: 'Eduardo Canul Tun',
    pacienteMes: 'Eduardo Canul',
    pacienteSemana: 'Eduardo Canul Tun',
    terapeuta: 'Dr. Alejandro Pech',
    sala: 'Consultorio B-3',
    salaCorta: 'Cons. B-3',
  },
  {
    id: '3',
    fecha: '2026-10-12',
    hora: '11:30',
    duracion: '1h',
    paciente: 'Ana Beatriz Canul Dzib',
    pacienteMes: 'Ana Canul Dzib',
    pacienteSemana: 'Ana Canul Dzib',
    terapeuta: 'Mtro. Gabriel Tun',
    sala: 'Consultorio B-2',
    salaCorta: 'Cons. B-2',
  },
  {
    id: '4',
    fecha: '2026-10-13',
    hora: '09:00',
    duracion: '1h',
    paciente: 'Jorge Pech May',
    pacienteMes: 'Jorge Pech',
    pacienteSemana: 'Jorge Pech May',
    terapeuta: 'Dr. Alejandro Pech',
    sala: 'Consultorio B-2',
    salaCorta: 'Cons. B-2',
  },
  {
    id: '5',
    fecha: '2026-10-14',
    hora: '11:00',
    duracion: '1h',
    paciente: 'Ana Canul Dzib',
    pacienteMes: 'Ana Canul',
    pacienteSemana: 'Ana Canul Dzib',
    terapeuta: 'Mtra. Sofía May',
    sala: 'Consultorio A-1',
    salaCorta: 'Cons. A-1',
  },
  {
    id: '6',
    fecha: '2026-10-15',
    hora: '14:00',
    duracion: '1h',
    paciente: 'Carlos May Pech',
    pacienteMes: 'Carlos May',
    pacienteSemana: 'Carlos May Pech',
    terapeuta: 'Dr. Alejandro Pech',
    sala: 'Consultorio C-1',
    salaCorta: 'Cons. C-1',
  },
  {
    id: '7',
    fecha: '2026-10-16',
    hora: '10:00',
    duracion: '1h',
    paciente: 'V. Pool Canche',
    pacienteMes: 'V. Pool Canche',
    pacienteSemana: 'V. Pool Canche',
    terapeuta: 'Dr. Alejandro Pech',
    sala: 'Consultorio B-3',
    salaCorta: 'Cons. B-3',
  },
];

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

export const NOMBRES_DIAS_COMPLETO: string[] = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatFechaISO(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

export function getLunesDeSemana(date: Date): Date {
  const d = new Date(date);
  const diaSemana = d.getDay(); // 0 = Dom, 1 = Lun...
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diff);
  return d;
}
