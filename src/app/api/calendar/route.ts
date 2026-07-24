/**
 * GET /api/calendar?month=YYYY-MM
 *
 * spec 2.3 v2 · Datos del módulo de Calendario. Devuelve dos series de
 * eventos dentro del mes solicitado:
 *   - turnos: reparaciones con scheduledAt (ingreso al taller)
 *   - entregas: reparaciones con estimatedDeliveryAt (entrega estimada)
 *
 * Ampliamos el rango de búsqueda a un padding de 7 días antes/después para
 * que las semanas parciales del comienzo/fin del mes muestren sus eventos
 * cuando el calendario renderiza toda la grilla (6 filas × 7 días).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type CalendarEvent = {
  repairId: string;
  internalNumber: number | null;
  customerName: string;
  vehicleSummary: string;
  vehicleDomain: string;
  date: string;
  needsTransport: boolean;
  status: string;
  notes: string | null;
};

const REPAIR_SELECT = {
  id: true,
  internalNumber: true,
  customerName: true,
  vehicleBrand: true,
  vehicleModel: true,
  vehicleDomain: true,
  scheduledAt: true,
  estimatedDeliveryAt: true,
  needsTransport: true,
  status: true,
  notes: true,
} as const;

function summarizeVehicle(r: {
  vehicleBrand: string;
  vehicleModel: string;
}): string {
  return `${r.vehicleBrand} ${r.vehicleModel}`.trim();
}

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const now = new Date();
  let monthRef: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    monthRef = new Date(y, m - 1, 1);
  } else {
    monthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Rango con padding: 7 días antes del 1 y 7 después del último. Cubre las
  // celdas visibles de una grilla de mes de 6 filas incluso cuando el 1 cae
  // domingo o el último cae lunes.
  const rangeStart = new Date(monthRef);
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(
    monthRef.getFullYear(),
    monthRef.getMonth() + 1,
    1,
  );
  rangeEnd.setDate(rangeEnd.getDate() + 7);

  const [scheduled, deliveries] = await Promise.all([
    prisma.repair.findMany({
      where: {
        scheduledAt: { gte: rangeStart, lt: rangeEnd },
        // Archivados no deberían aparecer en el calendario — ya se
        // completaron. Filtramos para no ensuciar la vista.
        status: { not: "archivado" },
      },
      select: REPAIR_SELECT,
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.repair.findMany({
      where: {
        estimatedDeliveryAt: { gte: rangeStart, lt: rangeEnd },
        status: { not: "archivado" },
      },
      select: REPAIR_SELECT,
      orderBy: { estimatedDeliveryAt: "asc" },
    }),
  ]);

  const turnos: CalendarEvent[] = scheduled
    .filter((r) => r.scheduledAt)
    .map((r) => ({
      repairId: r.id,
      internalNumber: r.internalNumber,
      customerName: r.customerName,
      vehicleSummary: summarizeVehicle(r),
      vehicleDomain: r.vehicleDomain,
      date: r.scheduledAt!.toISOString(),
      needsTransport: r.needsTransport,
      status: r.status,
      notes: r.notes,
    }));

  const entregas: CalendarEvent[] = deliveries
    .filter((r) => r.estimatedDeliveryAt)
    .map((r) => ({
      repairId: r.id,
      internalNumber: r.internalNumber,
      customerName: r.customerName,
      vehicleSummary: summarizeVehicle(r),
      vehicleDomain: r.vehicleDomain,
      date: r.estimatedDeliveryAt!.toISOString(),
      needsTransport: r.needsTransport,
      status: r.status,
      notes: r.notes,
    }));

  return NextResponse.json({
    month: `${monthRef.getFullYear()}-${String(monthRef.getMonth() + 1).padStart(2, "0")}`,
    turnos,
    entregas,
  });
}
