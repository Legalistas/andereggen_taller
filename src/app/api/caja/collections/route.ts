/**
 * GET /api/caja/collections
 *
 * spec 4.2 v2 · Cobros por vehículo. Se nutre automáticamente de las
 * RepairInvoice + payments de cada reparación. Cada row corresponde a un
 * repair con su totalización.
 *
 * Query:
 *   - status=pendiente|parcial|total   (opcional)
 *   - search=texto                     (cliente / patente / N° interno)
 *
 * Columnas devueltas (spec 4.2):
 *   internalNumber, customerName, vehicleDomain, insuranceCompany,
 *   totalAmount, paidAmount, remainingAmount, status,
 *   lastPaymentMethod, cashBoxes (destinos), lastPaidAt
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type CollectionStatus = "pendiente" | "parcial" | "total" | "sin_facturar";

function computeStatus(
  total: number,
  paid: number,
): CollectionStatus {
  if (total <= 0) return "sin_facturar";
  if (paid <= 0) return "pendiente";
  if (paid + 1 >= total) return "total"; // tolerancia $1 (redondeo)
  return "parcial";
}

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") as CollectionStatus | null;
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";

  // Traemos todos los repairs que tienen al menos una factura o que están
  // en pendientes_cobro/experiencia_cliente/archivado (pueden no tener
  // factura aún pero corresponden al bucket "cobros").
  const repairs = await prisma.repair.findMany({
    where: {
      OR: [
        { invoices: { some: {} } },
        { status: { in: ["pendientes_cobro", "experiencia_cliente", "archivado"] } },
      ],
    },
    select: {
      id: true,
      internalNumber: true,
      customerName: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleDomain: true,
      insuranceCompany: true,
      status: true,
      deliveredAt: true,
      lead: { select: { insuranceResponsibility: true } },
      invoices: {
        select: {
          amount: true,
          payments: {
            select: {
              amount: true,
              method: true,
              paidAt: true,
              cashBox: { select: { id: true, name: true, key: true } },
            },
            orderBy: { paidAt: "desc" },
          },
        },
      },
    },
    orderBy: [{ deliveredAt: "desc" }, { updatedAt: "desc" }],
    take: 500,
  });

  const rows = repairs.map((r) => {
    const totalAmount = r.invoices.reduce((a, i) => a + Number(i.amount), 0);
    let paidAmount = 0;
    let lastPaidAt: Date | null = null;
    let lastMethod: string | null = null;
    const boxes = new Map<string, { id: string; name: string; total: number }>();
    for (const inv of r.invoices) {
      for (const p of inv.payments) {
        const amt = Number(p.amount);
        paidAmount += amt;
        if (!lastPaidAt || p.paidAt > lastPaidAt) {
          lastPaidAt = p.paidAt;
          lastMethod = p.method;
        }
        if (p.cashBox) {
          const acc = boxes.get(p.cashBox.id) ?? {
            id: p.cashBox.id,
            name: p.cashBox.name,
            total: 0,
          };
          acc.total += amt;
          boxes.set(p.cashBox.id, acc);
        }
      }
    }
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const status = computeStatus(totalAmount, paidAmount);

    return {
      repairId: r.id,
      internalNumber: r.internalNumber,
      customerName: r.customerName,
      vehicleSummary: `${r.vehicleBrand} ${r.vehicleModel}`.trim(),
      vehicleDomain: r.vehicleDomain,
      insuranceCompany: r.insuranceCompany,
      insuranceResponsibility: r.lead?.insuranceResponsibility ?? null,
      repairStatus: r.status,
      totalAmount,
      paidAmount,
      remainingAmount,
      status,
      lastPaidAt: lastPaidAt?.toISOString() ?? null,
      lastMethod,
      cashBoxes: Array.from(boxes.values()),
    };
  });

  const filtered = rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (search) {
      const hay = `${row.customerName} ${row.vehicleDomain} ${row.internalNumber ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return NextResponse.json({ rows: filtered });
}
