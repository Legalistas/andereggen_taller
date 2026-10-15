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
  /** Urgencia del cliente — interno, se pinta en amarillo flúo. */
  isUrgent: boolean;
  /** Prioridad media (amarillo); `isUrgent` es la alta (rojo). */
  isPriority: boolean;
  urgencyNote: string | null;
  /** Repuestos del vehículo por etapa — para saber si la entrega es viable. */
  compras: {
    total: number;
    porDefinir: number;
    enCamino: number;
    enTaller: number;
    pendientePago: number;
  } | null;
  /** Plata del caso: aprobado vs facturado vs cobrado. */
  admin: { aprobado: number | null; facturado: number; cobrado: number };
  /**
   * Quién provee los repuestos: "TALLER" | "SEGURO". Solo informativo en el
   * calendario — el taller quiere ver de un vistazo si tiene que comprarlos.
   */
  partsPurchaser: string | null;
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
  isUrgent: true,
  isPriority: true,
  urgencyNote: true,
  approvedInsurance: true,
  approvedFranchise: true,
  approvedCustomer: true,
  partsPurchaser: true,
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

  // spec Calendario v3 · Compras y facturación por vehículo, en dos queries
  // para todo el mes (no una por evento). Una compra llega a la tarjeta por
  // su presupuesto (principal o siniestro), directo o vía el repuesto.
  const ids = [...new Set([...scheduled, ...deliveries].map((r) => r.id))];
  const viaBudget = {
    OR: [{ repair: { id: { in: ids } } }, { claim: { repairId: { in: ids } } }],
  };
  const repairOf = {
    select: {
      repair: { select: { id: true } },
      claim: { select: { repairId: true } },
    },
  };
  const [purchases, invoices] = ids.length
    ? await Promise.all([
        prisma.purchase.findMany({
          where: { OR: [{ budget: viaBudget }, { item: { budget: viaBudget } }] },
          select: {
            status: true,
            budget: repairOf,
            item: { select: { budget: repairOf } },
          },
        }),
        prisma.repairInvoice.findMany({
          where: { repairId: { in: ids } },
          select: {
            repairId: true,
            amount: true,
            payments: { select: { amount: true } },
          },
        }),
      ])
    : [[], []];

  const compras = new Map<string, NonNullable<CalendarEvent["compras"]>>();
  for (const p of purchases) {
    const b = p.budget ?? p.item?.budget;
    const rid = b?.repair?.id ?? b?.claim?.repairId;
    if (!rid) continue;
    const c = compras.get(rid) ?? {
      total: 0,
      porDefinir: 0,
      enCamino: 0,
      enTaller: 0,
      pendientePago: 0,
    };
    c.total += 1;
    if (p.status === "COTIZAR" || p.status === "DECIDIR") c.porDefinir += 1;
    else if (p.status === "PENDIENTE_PAGO") c.pendientePago += 1;
    else if (p.status === "EN_TALLER" || p.status === "ARCHIVADA")
      c.enTaller += 1;
    else c.enCamino += 1;
    compras.set(rid, c);
  }
  const admin = new Map<string, { facturado: number; cobrado: number }>();
  for (const inv of invoices) {
    const a = admin.get(inv.repairId) ?? { facturado: 0, cobrado: 0 };
    a.facturado += Number(inv.amount);
    a.cobrado += inv.payments.reduce((s, x) => s + Number(x.amount), 0);
    admin.set(inv.repairId, a);
  }

  const toEvent = (r: (typeof scheduled)[number], date: Date): CalendarEvent => {
    const approved =
      r.approvedInsurance === null &&
      r.approvedFranchise === null &&
      r.approvedCustomer === null
        ? null
        : Number(r.approvedInsurance ?? 0) +
          Number(r.approvedFranchise ?? 0) +
          Number(r.approvedCustomer ?? 0);
    return {
      repairId: r.id,
      internalNumber: r.internalNumber,
      customerName: r.customerName,
      vehicleSummary: summarizeVehicle(r),
      vehicleDomain: r.vehicleDomain,
      date: date.toISOString(),
      needsTransport: r.needsTransport,
      isUrgent: r.isUrgent,
      isPriority: r.isPriority,
      urgencyNote: r.urgencyNote,
      partsPurchaser: r.partsPurchaser,
      status: r.status,
      notes: r.notes,
      compras: compras.get(r.id) ?? null,
      admin: { aprobado: approved, ...(admin.get(r.id) ?? { facturado: 0, cobrado: 0 }) },
    };
  };

  const turnos: CalendarEvent[] = scheduled
    .filter((r) => r.scheduledAt)
    .map((r) => toEvent(r, r.scheduledAt as Date));

  const entregas: CalendarEvent[] = deliveries
    .filter((r) => r.estimatedDeliveryAt)
    .map((r) => toEvent(r, r.estimatedDeliveryAt as Date));

  return NextResponse.json({
    month: `${monthRef.getFullYear()}-${String(monthRef.getMonth() + 1).padStart(2, "0")}`,
    turnos,
    entregas,
  });
}
