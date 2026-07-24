/**
 * GET /api/calendar/pending
 *
 * spec 2.3 v2 · Repairs con status `turno_a_asignar` — oportunidades
 * ganadas que todavía no tienen turno coordinado con el cliente. Se listan
 * al costado del calendario para poder asignarles fecha/hora sin salir del
 * módulo.
 *
 * Al asignar `scheduledAt` desde la ficha, el repair salta automáticamente
 * a `turno_asignado` (hook `willTriggerTurnAssigned` en
 * `/api/repairs/[id]`) y dispara el mail de confirmación al cliente.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const repairs = await prisma.repair.findMany({
    where: { status: "turno_a_asignar" },
    select: {
      id: true,
      internalNumber: true,
      customerName: true,
      customerPhone: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleDomain: true,
      insuranceCompany: true,
      estimatedDeliveryAt: true,
      needsTransport: true,
      createdAt: true,
      lead: {
        select: { customer: { select: { city: true } } },
      },
    },
    // Los más viejos primero — son los que llevan más tiempo esperando
    // que se coordine el turno.
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    rows: repairs.map((r) => ({
      repairId: r.id,
      internalNumber: r.internalNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerCity: r.lead?.customer?.city ?? null,
      vehicleSummary: `${r.vehicleBrand} ${r.vehicleModel}`.trim(),
      vehicleDomain: r.vehicleDomain,
      insuranceCompany: r.insuranceCompany,
      estimatedDeliveryAt: r.estimatedDeliveryAt?.toISOString() ?? null,
      needsTransport: r.needsTransport,
      waitingSince: r.createdAt.toISOString(),
    })),
  });
}
