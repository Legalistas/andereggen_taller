/**
 * spec Compras v3 · Auto-creación de Purchases al ganar el lead.
 *
 * Al marcar el lead como Ganado con `partsPurchaser` = TALLER o SEGURO,
 * se crea una Purchase por cada BudgetAdminItem del budget del repair:
 *   - TALLER → status DECIDIR (van al circuito administrativo normal)
 *   - SEGURO → status SEGURO + supplierName = "Seguro"
 *
 * Idempotente: si ya existe una Purchase para el itemId, no la duplica.
 */

import type {
  PartsPurchaser,
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client";
import { nextPurchaseNumber } from "./number";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function autoCreatePurchasesForItems(
  tx: PrismaLike,
  budgetId: string,
  purchaser: PartsPurchaser,
  createdById: string | null,
): Promise<void> {
  const items = await tx.budgetAdminItem.findMany({
    where: { budgetId },
    select: { id: true, purchases: { select: { id: true }, take: 1 } },
  });

  const targets = items.filter((i) => i.purchases.length === 0);
  if (targets.length === 0) return;

  for (const item of targets) {
    const number = await nextPurchaseNumber(tx, item.id);
    await tx.purchase.create({
      data: {
        itemId: item.id,
        number,
        status: purchaser === "SEGURO" ? "SEGURO" : "DECIDIR",
        // Marca visual — la UI muestra "Seguro" como categoría/proveedor.
        supplierName: purchaser === "SEGURO" ? "Seguro" : null,
        createdById,
      },
    });
  }
}
