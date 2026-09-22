/**
 * POST /api/budgets/[id]/refresh-snapshot
 *
 * Vuelve a copiar los datos actuales del cliente y del vehículo al snapshot
 * del presupuesto. Los presupuestos abiertos (borrador / enviado / vencido) se
 * refrescan solos al editar cliente o vehículo; este endpoint es para los
 * aceptados y rechazados, que quedan congelados a propósito y solo se
 * actualizan si alguien lo pide expresamente desde la ficha.
 *
 * No toca importes ni conceptos: solo los datos de cabecera (nombre, DNI,
 * dirección, patente, chasis, seguro, cobertura y franquicia).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { refreshBudgetSnapshot } from "@/lib/budget-snapshot";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const budget = await refreshBudgetSnapshot(id);
  if (!budget) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ budget });
}
