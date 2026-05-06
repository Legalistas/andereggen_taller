/**
 * GET /api/budgets/[id]/admin
 * Devuelve la pestaña administrativa del presupuesto: items con sus
 * cotizaciones de proveedores y la compra realizada (si la hay).
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
      purchase: true,
    },
  });

  return NextResponse.json({ items });
}
