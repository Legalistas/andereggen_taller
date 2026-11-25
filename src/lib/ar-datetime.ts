/**
 * Fecha y hora de los `<input type="datetime-local">` (turnos) siempre en hora
 * argentina, sin depender de la zona horaria de la PC de quien carga: una PC
 * mal configurada guardaba el turno corrido y el mail salía con otra hora
 * (bug B2). Argentina no tiene horario de verano: UTC-3 fijo todo el año.
 */

const AR_OFFSET_MS = 3 * 3_600_000;

/** ISO → `YYYY-MM-DDTHH:mm` en hora argentina. */
export function isoToArDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - AR_OFFSET_MS)
    .toISOString()
    .slice(0, 16);
}

/** `YYYY-MM-DDTHH:mm` leído como hora argentina → ISO (UTC). */
export function arDateTimeInputToIso(value: string): string {
  return new Date(`${value}:00-03:00`).toISOString();
}
