/**
 * Formatters de valores del tablero de KPIs.
 * Basados en el tipo declarado en el catálogo (`number` / `currency` /
 * `percent` / `days`).
 */

import type { KpiValueType } from "@/lib/kpis/catalog";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const INT = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

const DEC1 = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

/** Formatea un valor de una celda según su tipo. Null → guión. */
export function formatKpiValue(
  value: number | null,
  type: KpiValueType,
): string {
  if (value === null || value === undefined) return "—";
  switch (type) {
    case "currency":
      return ARS.format(value);
    case "percent":
      return `${DEC1.format(value)}%`;
    case "days":
      return `${DEC1.format(value)}d`;
    default:
      return INT.format(value);
  }
}

/** Formatea la variación VMA como "+12.3%" / "-4.5%" / "0%". Null → "—". */
export function formatVma(percent: number | null): string {
  if (percent === null || percent === undefined) return "—";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${DEC1.format(percent)}%`;
}

/** Suma de la serie ignorando null. Usada para la columna "Acumulado". */
export function sumSeries(series: Array<number | null>): number | null {
  const filtered = series.filter((v): v is number => v !== null);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0);
}

/** Promedio de la serie (para métricas tipo `days`/`percent` que no se
 *  acumulan). Ignora null. */
export function avgSeries(series: Array<number | null>): number | null {
  const filtered = series.filter((v): v is number => v !== null);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

/** Elige entre suma o promedio según el tipo: currency/number suman;
 *  percent/days promedian. */
export function accumulateSeries(
  series: Array<number | null>,
  type: KpiValueType,
): number | null {
  if (type === "percent" || type === "days") return avgSeries(series);
  return sumSeries(series);
}
