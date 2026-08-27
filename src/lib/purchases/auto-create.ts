/**
 * spec Compras v3 · Auto-creación de Purchases al ganar el lead.
 *
 * Al marcar el lead como Ganado con `partsPurchaser` = TALLER o SEGURO,
 * se crea una Purchase por cada BudgetAdminItem del budget del repair:
 *   - TALLER → status DECIDIR (van al circuito administrativo normal)
 *   - SEGURO → status SEGURO + supplierName = "Seguro"
 *
 * Idempotente: si ya existe una Purchase para el itemId, no la duplica.
 *
 * Perf: todo en 3 queries fijas (findUnique budget + findMany purchases
 * existentes con el prefix + createMany), independiente del N de items.
 * El flujo anterior era O(N*3) queries y timeouteaba con budgets grandes.
 */

import type {
  PartsPurchaser,
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function autoCreatePurchasesForItems(
  tx: PrismaLike,
  budgetId: string,
  purchaser: PartsPurchaser,
  createdById: string | null,
): Promise<void> {
  // Traemos budget (para el prefix) + items con flag de "ya tiene purchase"
  // en una sola query.
  const budget = await tx.budget.findUnique({
    where: { id: budgetId },
    select: {
      number: true,
      repair: { select: { internalNumber: true } },
      adminItems: {
        select: { id: true, purchases: { select: { id: true }, take: 1 } },
      },
    },
  });
  if (!budget) return;

  const targets = budget.adminItems.filter((i) => i.purchases.length === 0);
  if (targets.length === 0) return;

  // Prefix único para todos los items del budget (mismo N° o INT-<n>).
  const prefix =
    budget.number !== undefined && budget.number !== null
      ? String(budget.number)
      : budget.repair?.internalNumber
        ? `INT-${budget.repair.internalNumber}`
        : null;
  if (!prefix) {
    // Sin identificador no podemos generar N° de compra — abortamos silencioso.
    return;
  }

  // Max seq actual del prefix (una sola query en vez de N).
  const existing = await tx.purchase.findMany({
    where: { number: { startsWith: `${prefix}.` } },
    select: { number: true },
  });
  let maxSeq = 0;
  for (const row of existing) {
    const n = Number(row.number.slice(prefix.length + 1));
    if (Number.isInteger(n) && n > maxSeq) maxSeq = n;
  }

  await tx.purchase.createMany({
    data: targets.map((item, i) => ({
      itemId: item.id,
      number: `${prefix}.${maxSeq + i + 1}`,
      status: (purchaser === "SEGURO" ? "SEGURO" : "DECIDIR") as
        | "SEGURO"
        | "DECIDIR",
      supplierName: purchaser === "SEGURO" ? "Seguro" : null,
      createdById,
    })),
  });
}
