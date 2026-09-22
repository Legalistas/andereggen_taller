/**
 * GET /api/budgets/[id]/admin
 * Devuelve la pestaña administrativa del presupuesto: items con sus
 * cotizaciones de proveedores y la compra realizada (si la hay), más las
 * compras sueltas del vehículo — las que no cuelgan de ningún repuesto
 * (insumos, sellador, un flete aparte). Antes solo se veían desde el módulo
 * Compras.
 *
 * POST /api/budgets/[id]/admin/items
 * Crea un nuevo item (repuesto a cotizar) en la pestaña administrativa.
 * Body: { description, notes?, photos? }
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const budget = await prisma.budget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!budget) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  const items = await prisma.budgetAdminItem.findMany({
    where: { budgetId: id },
    orderBy: { order: "asc" },
    include: {
      quotes: { orderBy: { createdAt: "asc" } },
      // spec Compras v2 · Ahora hay N Purchases por ítem (con status).
      // Devolvemos todo — la UI vieja seguía leyendo `item.purchase` y
      // ahora obtiene `item.purchases[]`. En FASE 5 se refactorea el
      // BudgetAdminDialog para consumir la nueva shape.
      // spec Compras v4 · Los pagos parciales viajan con cada compra para
      // que la administrativa muestre el estado de pago real (pagada /
      // parcial / sin pagar) sin tener que abrir el detalle.
      purchases: {
        orderBy: { createdAt: "desc" },
        include: { payments: { select: { kind: true, amount: true } } },
      },
    },
  });

  // spec Compras v4 · Compras del presupuesto sin repuesto asociado. Mismo
  // shape que las de los ítems para que la UI use la misma tabla.
  const directPurchases = await prisma.purchase.findMany({
    where: { budgetId: id, itemId: null },
    orderBy: { createdAt: "desc" },
    include: { payments: { select: { kind: true, amount: true } } },
  });

  return NextResponse.json({ items, directPurchases });
}
