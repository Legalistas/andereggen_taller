/**
 * GET /api/repairs/[id]/linkable-budgets
 *
 * Presupuestos que se pueden vincular a la tarjeta como un siniestro más
 * (spec Producción v4): los del mismo cliente o del mismo vehículo que todavía
 * no son siniestro de ninguna tarjeta.
 *
 * Se excluyen las ampliaciones: una ampliación pertenece al siniestro de su
 * presupuesto padre y ya se suma sola a los importes aprobados.
 *
 * `repair` en cada fila indica si ese presupuesto ya generó su propia tarjeta
 * en Producción — esas son las que hay que absorber al vincular, y la ficha
 * lo avisa antes de fusionar.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const repair = await prisma.repair.findUnique({
    where: { id },
    select: { id: true, customerId: true, vehicleDomain: true },
  });
  if (!repair) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  const budgets = await prisma.budget.findMany({
    where: {
      // Solo presupuestos originales (las ampliaciones van con su padre).
      parentBudgetId: null,
      // Libres: todavía no son siniestro de ninguna tarjeta.
      claim: { is: null },
      status: { not: "rejected" },
      OR: [
        ...(repair.customerId
          ? [{ lead: { customerId: repair.customerId } }]
          : []),
        { vehicleDomain: repair.vehicleDomain },
      ],
    },
    select: {
      id: true,
      number: true,
      status: true,
      grandTotal: true,
      laborTotal: true,
      partsSubtotal: true,
      customerName: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleDomain: true,
      createdAt: true,
      // Si tiene tarjeta propia, vincularlo significa absorberla.
      repair: {
        select: { id: true, internalNumber: true, status: true },
      },
    },
    orderBy: { number: "desc" },
    take: 30,
  });

  return NextResponse.json({
    budgets: budgets.filter((b) => b.repair?.id !== id),
  });
}
