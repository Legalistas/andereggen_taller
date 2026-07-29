/**
 * VMA (variación vs mes anterior) + semáforo — spec KPIs jul '26.
 *
 * Reglas del brief:
 *  - Umbral flat: |percent| < 0.5%
 *  - Semáforo:
 *      percent ≥ 0     → verde
 *      -5% < p < 0     → amarillo
 *      p ≤ -5%         → rojo
 *  - Métricas "invertidas" (donde bajar es bueno — reclamos, tiempo en
 *    taller, egresos): se invierte el signo del percent para el semáforo.
 */

export type VmaDirection = "up" | "down" | "flat";
export type Semaphore = "green" | "yellow" | "red" | "na";

export type Vma = {
  /** Porcentaje de variación (0-100+). null si no hay comparación posible. */
  percent: number | null;
  /** Movimiento crudo (independiente de si es una métrica invertida). */
  direction: VmaDirection;
  /** Delta absoluto: current - previous. */
  absolute: number | null;
};

const FLAT_THRESHOLD = 0.5;
const RED_THRESHOLD = -5;

/**
 * Calcula VMA comparando dos valores. Si `previous` es 0 y `current` es 0
 * → flat; si `previous` es 0 y `current` > 0 → up 100%. Si `current` es
 * null (mes sin data) → { percent: null }.
 */
export function computeVMA(
  current: number | null,
  previous: number | null,
): Vma {
  if (current === null || previous === null) {
    return { percent: null, direction: "flat", absolute: null };
  }
  const absolute = current - previous;
  if (previous === 0 && current === 0) {
    return { percent: 0, direction: "flat", absolute: 0 };
  }
  if (previous === 0) {
    // Todo cambio desde 0 se considera +100% (evita división por cero).
    return {
      percent: current > 0 ? 100 : -100,
      direction: current > 0 ? "up" : "down",
      absolute,
    };
  }
  const percent = (absolute / Math.abs(previous)) * 100;
  const direction: VmaDirection =
    Math.abs(percent) < FLAT_THRESHOLD ? "flat" : percent > 0 ? "up" : "down";
  return { percent, direction, absolute };
}

/**
 * Semáforo del VMA para display en la matriz. Para métricas invertidas
 * (reclamos, tiempo en taller, egresos): un valor MÁS BAJO es mejor, así
 * que se invierte el signo para el cálculo del color.
 */
export function vmaSemaphore(
  vma: Vma,
  opts: { inverted?: boolean } = {},
): Semaphore {
  if (vma.percent === null) return "na";
  const effective = opts.inverted ? -vma.percent : vma.percent;
  if (effective >= 0) return "green";
  if (effective > RED_THRESHOLD) return "yellow";
  return "red";
}

/** Devuelve el par current/previous a partir de una serie mensual y un
 *  índice de "mes actual" (0-11). El previo es siempre el índice-1 dentro
 *  del mismo año — si es enero, previous es null (no cross-year por ahora). */
export function pickCurrentAndPrevious(
  monthly: Array<number | null>,
  currentMonthIndex: number,
): { current: number | null; previous: number | null } {
  const current = monthly[currentMonthIndex] ?? null;
  const previous =
    currentMonthIndex > 0 ? (monthly[currentMonthIndex - 1] ?? null) : null;
  return { current, previous };
}
