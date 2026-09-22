import type { Prisma } from "../../generated/prisma/client";
// Solo se usa como tipo: el cliente real lo inyecta cada route.
import type { prisma } from "./prisma";

/**
 * Siniestros de una reparación (spec Producción v4).
 *
 * Un mismo vehículo puede estar en el taller por dos siniestros a la vez.
 * Antes eso obligaba a abrir dos tarjetas (y a repetir el Nº interno, que era
 * único); ahora las dos aprobaciones cuelgan de la misma tarjeta, cada una con
 * su presupuesto y su desglose de mano de obra / repuestos.
 *
 * `Repair.approvedInsurance` sigue existiendo y es la suma de los claims: lo
 * leen el kanban, la lista, las facturas y los cobros, así que lo mantenemos
 * materializado en vez de recalcularlo en cada lectura.
 */

/** Presupuesto que se muestra junto al siniestro en la ficha de Producción. */
export const CLAIM_BUDGET_SELECT = {
  id: true,
  number: true,
  extensionSuffix: true,
  status: true,
  grandTotal: true,
  // Mano de obra y repuestos presupuestados: sirven de default cuando el
  // seguro aprueba el presupuesto tal cual y no hay que recortar nada.
  laborTotal: true,
  partsSubtotal: true,
} satisfies Prisma.BudgetSelect;

export const CLAIM_INCLUDE = {
  budget: { select: CLAIM_BUDGET_SELECT },
} satisfies Prisma.RepairClaimInclude;

export const CLAIM_ORDER_BY = [
  { order: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.RepairClaimOrderByWithRelationInput[];

export type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Recalcula `Repair.approvedInsurance` como la suma de (mano de obra +
 * repuestos) de todos los siniestros. Devuelve null cuando ningún siniestro
 * tiene importes cargados, para distinguir "no aprobado todavía" de
 * "aprobado en $0" (el kanban muestra el importe del presupuesto mientras
 * no haya aprobación).
 */
export async function syncApprovedInsurance(
  tx: Tx,
  repairId: string,
): Promise<number | null> {
  const claims = await tx.repairClaim.findMany({
    where: { repairId },
    select: { approvedLabor: true, approvedParts: true },
  });

  const hasAmounts = claims.some(
    (c) => c.approvedLabor !== null || c.approvedParts !== null,
  );
  const total = hasAmounts
    ? claims.reduce(
        (acc, c) => acc + Number(c.approvedLabor ?? 0) + Number(c.approvedParts ?? 0),
        0,
      )
    : null;

  // Igual que al cargar el importe a mano en la ficha: si es la primera
  // aprobación y nadie puso fecha, queda la de hoy.
  const repair = await tx.repair.findUnique({
    where: { id: repairId },
    select: { approvedAt: true },
  });

  await tx.repair.update({
    where: { id: repairId },
    data: {
      approvedInsurance: total,
      ...(total !== null && !repair?.approvedAt && { approvedAt: new Date() }),
    },
  });

  return total;
}

/** Próximo `order` libre dentro de la tarjeta (1, 2, 3…). */
export async function nextClaimOrder(
  tx: Tx,
  repairId: string,
): Promise<number> {
  const agg = await tx.repairClaim.aggregate({
    where: { repairId },
    _max: { order: true },
  });
  return (agg._max.order ?? 0) + 1;
}

/**
 * Parsea un importe que puede venir como number, string numérico, "" o null.
 * `undefined` = el campo no vino en el body (no se toca).
 */
export function parseClaimAmount(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("Importe inválido");
  return n;
}
