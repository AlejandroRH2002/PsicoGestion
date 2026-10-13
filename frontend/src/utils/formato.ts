// Formatos de presentación compartidos por los módulos de terapeutas y pacientes.

/** 9991234567 → "+52 999 123 4567" */
export function formatearTelefono(telefono: string): string {
  return `+52 ${formatearTelefonoLocal(telefono)}`;
}

/** 9991234567 → "999 123 4567" (formato de la máscara del formulario) */
export function formatearTelefonoLocal(telefono: string): string {
  const d = telefono.replace(/\D/g, '').slice(0, 10);
  if (d.length > 6) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return d;
}

/** Fecha sin hora "1985-08-14" → "14/08/1985" */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Timestamp (UTC) → "dd/mm/aaaa" en la zona horaria local, p. ej. la fecha de baja. */
export function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Máscara dd/mm/aaaa mientras se escribe. */
export function mascaraFecha(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** 2_400_000 → "2.29 MB"; 2048 → "2 KB" */
export function formatearTamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
