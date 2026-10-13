// spec Tarjetas oct '26 · Cuotas de una compra con tarjeta, sin base de datos.
// El "resumen" es un mes ("AAAA-MM"); la primera cuota cae en el resumen del
// mes siguiente a la compra, salvo que se elija otro, y las demás en los
// meses que siguen.

export const MAX_CUOTAS = 36;
export const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Mes de una fecha, "AAAA-MM", en hora local. */
export const periodoDe = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;

/** "AAAA-MM" + n meses. */
export function sumarMeses(periodo: string, n: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
  /** Resumen de la primera cuota; sin dato, el mes siguiente a la compra. */
  primerPeriodo?: string;
}): { number: number; total: number; period: string; amount: number }[] {
  const primero = input.primerPeriodo ?? sumarMeses(periodoDe(input.fecha), 1);
  return repartirCuotas(input.total, input.cuotas).map((amount, i) => ({
    number: i + 1,
    total: input.cuotas,
    period: sumarMeses(primero, i),
    amount,
  }));
}
