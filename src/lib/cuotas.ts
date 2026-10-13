// spec Tarjetas oct '26 · Cuotas de una compra con tarjeta, sin base de datos.
// Mismas reglas que el backoffice de Legalistas.
//
// Resumen = mes en que cierra ("periodo" AAAA-MM). Una compra hecha hasta el
// día de cierre (inclusive) entra en el resumen de ese mes; después, en el del
// mes siguiente. Sin día de cierre cargado, la primera cuota va al mes
// siguiente a la compra. Las fechas son "solo día": se leen en UTC.

export const MAX_CUOTAS = 60;
export const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Día del mes (1-31) o null. `undefined` si vino algo que no es un día. */
export function leerDia(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
}

const diasDelMes = (anio: number, mes0: number) =>
  new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();

const periodoDe = (anio: number, mes0: number) =>
  `${anio}-${String(mes0 + 1).padStart(2, "0")}`;

/** "AAAA-MM" + n meses. */
export function sumarMeses(periodo: string, n: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return periodoDe(d.getUTCFullYear(), d.getUTCMonth());
}

/** Resumen en el que cae la primera cuota de una compra. */
export function periodoPrimeraCuota(
  fecha: Date,
  diaCierre: number | null,
): string {
  const anio = fecha.getUTCFullYear();
  const mes0 = fecha.getUTCMonth();
  const actual = periodoDe(anio, mes0);
  if (!diaCierre) return sumarMeses(actual, 1);
  const cierre = Math.min(diaCierre, diasDelMes(anio, mes0));
  return fecha.getUTCDate() <= cierre ? actual : sumarMeses(actual, 1);
}

/**
 * Vencimiento del resumen `periodo`. Si el día de vencimiento es menor o igual
 * al de cierre, vence el mes siguiente (cierra el 25, vence el 5 del otro mes);
 * si no, el mismo mes. Sin día de vencimiento: el 10 del mes siguiente.
 */
export function vencimientoResumen(
  periodo: string,
  diaCierre: number | null,
  diaVencimiento: number | null,
): Date {
  const mesSiguiente =
    !diaVencimiento || !diaCierre || diaVencimiento <= diaCierre;
  const [y, m] = (mesSiguiente ? sumarMeses(periodo, 1) : periodo)
    .split("-")
    .map(Number);
  const dia = Math.min(diaVencimiento ?? 10, diasDelMes(y, m - 1));
  return new Date(Date.UTC(y, m - 1, dia));
}

/** Reparte el total en n cuotas iguales; la última absorbe los centavos. */
export function repartirCuotas(total: number, n: number): number[] {
  const base = r2(total / n);
  const montos = Array.from({ length: n }, () => base);
  montos[n - 1] = r2(total - base * (n - 1));
  return montos;
}

export function planDeCuotas(input: {
  fecha: Date;
  total: number;
  cuotas: number;
  diaCierre: number | null;
  diaVencimiento: number | null;
  /** Para corregir a mano el resumen de la primera cuota. */
  primerPeriodo?: string;
}): {
  number: number;
  total: number;
  period: string;
  dueDate: Date;
  amount: number;
}[] {
  const primero =
    input.primerPeriodo ?? periodoPrimeraCuota(input.fecha, input.diaCierre);
  return repartirCuotas(input.total, input.cuotas).map((amount, i) => {
    const period = sumarMeses(primero, i);
    return {
      number: i + 1,
      total: input.cuotas,
      period,
      dueDate: vencimientoResumen(
        period,
        input.diaCierre,
        input.diaVencimiento,
      ),
      amount,
    };
  });
}
