/**
 * Generación del N° de compra — spec Compras v2.
 *
 * Formato: `<prefix>.<seq>` donde:
 *   - `prefix` = número del budget (ej. "4056") si el Repair tiene budget,
 *     o `"INT-" + internalNumber` si es directCreation.
 *   - `seq` = 1, 2, 3, ... contando todas las Purchases (activas +
 *     archivadas) que compartan prefix.
 *
 * Ej: "4056.1", "4056.2", "INT-192.1"
 *
 * Se calcula server-side dentro de una transacción para evitar colisiones.
 */

import type { PrismaClient, Prisma } from "../../../generated/prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Devuelve el prefix a usar para un item. Va al Budget del item; si el
 * Repair del budget es `directCreation` (sin budget en el Repair), o si no
 * hay Repair vinculado, cae al `internalNumber`. Si tampoco hay
 * internalNumber, tira error (no puede haber compra sin identificador).
 */
export async function resolvePurchasePrefix(
  tx: PrismaLike,
  itemId: string,
): Promise<string> {
  const item = await tx.budgetAdminItem.findUnique({
    where: { id: itemId },
    select: {
      budget: {
        select: {
          number: true,
          repair: { select: { internalNumber: true } },
        },
      },
    },
  });
  if (!item) throw new Error(`Item ${itemId} no encontrado`);

  const budgetNumber = item.budget?.number;
  if (budgetNumber !== undefined && budgetNumber !== null) {
    return String(budgetNumber);
  }
  const internalNumber = item.budget?.repair?.internalNumber;
  if (internalNumber !== undefined && internalNumber !== null) {
    return `INT-${internalNumber}`;
  }
  throw new Error(
    "No se puede generar N° de compra: el ítem no tiene budget ni internalNumber",
  );
}

/**
 * Devuelve el próximo `<prefix>.<seq>` para un item. Cuenta TODAS las
 * Purchases que tengan `number` que empieza con `prefix.` (incluye
 * archivadas y devoluciones) y devuelve el siguiente correlativo.
 */
export async function nextPurchaseNumber(
  tx: PrismaLike,
  itemId: string,
): Promise<string> {
  const prefix = await resolvePurchasePrefix(tx, itemId);
  return nextPurchaseNumberForPrefix(tx, prefix);
}

/**
 * spec v3 · Variante para compras directas (sin item). Toma un prefix
 * calculado según:
 *   - Si hay budgetId → número del budget.
 *   - Si no → "DIR" (compra directa suelta, sin presupuesto/vehículo).
 */
export async function nextPurchaseNumberDirect(
  tx: PrismaLike,
  budgetId: string | null,
): Promise<string> {
  let prefix = "DIR";
  if (budgetId) {
    const b = await tx.budget.findUnique({
      where: { id: budgetId },
      select: { number: true },
    });
    if (b?.number !== undefined && b?.number !== null) {
      prefix = String(b.number);
    }
  }
  return nextPurchaseNumberForPrefix(tx, prefix);
}

async function nextPurchaseNumberForPrefix(
  tx: PrismaLike,
  prefix: string,
): Promise<string> {
  const existing = await tx.purchase.findMany({
    where: { number: { startsWith: `${prefix}.` } },
    select: { number: true },
  });

  let max = 0;
  for (const row of existing) {
    const suffix = row.number.slice(prefix.length + 1); // después de "prefix."
    const n = Number(suffix);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}.${max + 1}`;
}
