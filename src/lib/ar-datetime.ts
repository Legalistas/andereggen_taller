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

/** El día argentino siguiente a `now`: [00:00, 24:00) en hora argentina. */
export function arTomorrowRange(now: Date): { from: Date; to: Date } {
  const today = new Date(now.getTime() - AR_OFFSET_MS).toISOString().slice(0, 10);
  const from = new Date(new Date(`${today}T00:00:00-03:00`).getTime() + 86_400_000);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/** `YYYY-MM-DDTHH:mm` leído como hora argentina → ISO (UTC). */
export function arDateTimeInputToIso(value: string): string {
  return new Date(`${value}:00-03:00`).toISOString();
}
