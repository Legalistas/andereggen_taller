/**
 * GET /api/caja/boxes
 *
 * spec sección 4.3 / 4.4 v2 · Devuelve las 5 cajas con saldo actual +
 * detalle de ingresos/egresos del mes, y las estadísticas contables
 * consolidadas (facturación del mes, cobros pendientes, egresos, saldo total,
 * cobros por compañía, días promedio de cobro post-entrega).
 *
 * Query: ?month=YYYY-MM (opcional — default = mes actual)
 *
 * Saldo de una caja = Σ (payments.amount de facturas destinadas a esa caja)
 *                    + Σ (movimientos INGRESO)
 *                    + Σ (movimientos TRANSFER_IN)
 *                    − Σ (movimientos EGRESO)
 *                    − Σ (movimientos TRANSFER_OUT)
 *
 * NOTA: Las transferencias entre cajas NO se suman al total consolidado
 * (se cancelan a sí mismas), por eso están separadas en su propio bucket.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

function parseMonth(monthParam: string | null): {
  monthRef: Date;
  startOfMonth: Date;
  startOfNextMonth: Date;
} {
  const now = new Date();
  let monthRef: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    monthRef = new Date(y, m - 1, 1);
  } else {
    monthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return {
    monthRef,
    startOfMonth: monthRef,
    startOfNextMonth: new Date(
      monthRef.getFullYear(),
      monthRef.getMonth() + 1,
      1,
    ),
  };
}

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const { monthRef, startOfMonth, startOfNextMonth } = parseMonth(
    url.searchParams.get("month"),
  );

  // spec 3.3 / T16 v2 · Gráfico de "Ingresos" (últimos 6 meses de cobros)
  // se mudó del dashboard general a Caja. Anclamos el eje al mes actual real,
  // no al mes seleccionado, para que la vista de "tendencia" siga siendo la
  // misma sin importar qué mes esté auditando el contable.
  const nowReal = new Date();
  const sixMonthsStart = new Date(
    nowReal.getFullYear(),
    nowReal.getMonth() - 5,
    1,
  );

  const [
    boxes,
    paymentsAll, // saldo histórico por caja
    paymentsMonth, // ingresos del mes por caja
    movementsAll, // saldo histórico por caja (manual)
    movementsMonth, // por caja + tipo
    officialPaymentsMonth, // facturación del mes = cobros a cajas oficiales
    pendingCollections, // cobros pendientes (histórico)
    avgDaysPost,
    monthPaymentsByInsurance,
    revenueSeriesRaw,
  ] = await Promise.all([
    prisma.cashBox.findMany({
      where: { archivedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.repairInvoicePayment.groupBy({
      by: ["cashBoxId"],
      where: { cashBoxId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.repairInvoicePayment.groupBy({
      by: ["cashBoxId"],
      where: {
        cashBoxId: { not: null },
        paidAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["cashBoxId", "type"],
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["cashBoxId", "type"],
      where: { paidAt: { gte: startOfMonth, lt: startOfNextMonth } },
      _sum: { amount: true },
    }),
    // spec 4.4 v2 · Facturación del mes = suma de los COBROS registrados
    // en el mes que hayan ido a una caja "oficial" (todas excepto Caja 2).
    // Caja 2 es la "línea negra" — efectivo interno que NO se factura, por
    // eso no debe sumar a este KPI aunque el usuario haya cargado el cobro
    // en el módulo. Los cobros sin caja asignada (histórico) se cuentan
    // para no perder facturado viejo.
    prisma.repairInvoicePayment.aggregate({
      where: {
        paidAt: { gte: startOfMonth, lt: startOfNextMonth },
        OR: [
          { cashBoxId: null },
          { cashBox: { key: { not: "caja_2" } } },
        ],
      },
      _sum: { amount: true },
    }),
    // Cobros pendientes = suma de saldos (invoice.amount − Σ payments) de
    // facturas emitidas cuyo saldo actual es > 0. Filtramos donde el repair
    // no está archivado (esas seguimos cobrándolas).
    prisma.repairInvoice.findMany({
      select: {
        amount: true,
        payments: { select: { amount: true } },
      },
    }),
    // Promedio de días entre delivery del vehículo y último pago. Solo
    // repairs con deliveredAt y al menos un pago posterior.
    prisma.$queryRaw<Array<{ avg_days: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (last_payment - "deliveredAt")) / 86400) AS avg_days
      FROM (
        SELECT r."deliveredAt",
               MAX(rip."paidAt") AS last_payment
        FROM "Repair" r
        JOIN "RepairInvoice" ri ON ri."repairId" = r."id"
        JOIN "RepairInvoicePayment" rip ON rip."invoiceId" = ri."id"
        WHERE r."deliveredAt" IS NOT NULL
        GROUP BY r."id", r."deliveredAt"
        HAVING MAX(rip."paidAt") > r."deliveredAt"
      ) t
    `,
    // Cobros del mes agrupados por compañía de seguros del repair. Nos sirve
    // para "Cobros por compañía" del panel de estadísticas contables.
    // Excluimos Caja 2 (línea negra) por el mismo motivo que en Facturación:
    // no es cobro formal por compañía.
    prisma.$queryRaw<
      Array<{ insurance_company: string | null; total: number }>
    >`
      SELECT r."insuranceCompany" AS insurance_company,
             SUM(rip."amount")::float AS total
      FROM "RepairInvoicePayment" rip
      JOIN "RepairInvoice" ri ON ri."id" = rip."invoiceId"
      JOIN "Repair" r ON r."id" = ri."repairId"
      LEFT JOIN "CashBox" cb ON cb."id" = rip."cashBoxId"
      WHERE rip."paidAt" >= ${startOfMonth}
        AND rip."paidAt" < ${startOfNextMonth}
        AND (cb."key" IS NULL OR cb."key" <> 'caja_2')
      GROUP BY r."insuranceCompany"
      ORDER BY total DESC
    `,
    // spec 3.3 / T16 · Serie mensual de cobros de los últimos 6 meses,
    // usada por el gráfico "Ingresos" que ahora vive en el módulo Caja.
    prisma.$queryRaw<Array<{ month: Date; total: number }>>`
      SELECT date_trunc('month', "paidAt")::timestamp AS month,
             SUM(amount)::float AS total
      FROM "RepairInvoicePayment"
      WHERE "paidAt" >= ${sixMonthsStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  // ── Ingresos totales por caja desde cobros de facturas
  const paidByBoxAll = new Map<string, number>();
  for (const r of paymentsAll) {
    if (!r.cashBoxId) continue;
    paidByBoxAll.set(r.cashBoxId, Number(r._sum.amount ?? 0));
  }
  const paidByBoxMonth = new Map<string, number>();
  for (const r of paymentsMonth) {
    if (!r.cashBoxId) continue;
    paidByBoxMonth.set(r.cashBoxId, Number(r._sum.amount ?? 0));
  }

  // ── Movimientos manuales por caja: acumulamos por tipo
  type MovBucket = {
    INGRESO: number;
    EGRESO: number;
    TRANSFER_IN: number;
    TRANSFER_OUT: number;
  };
  const emptyBucket = (): MovBucket => ({
    INGRESO: 0,
    EGRESO: 0,
    TRANSFER_IN: 0,
    TRANSFER_OUT: 0,
  });
  const movByBoxAll = new Map<string, MovBucket>();
  for (const r of movementsAll) {
    const b = movByBoxAll.get(r.cashBoxId) ?? emptyBucket();
    b[r.type] += Number(r._sum.amount ?? 0);
    movByBoxAll.set(r.cashBoxId, b);
  }
  const movByBoxMonth = new Map<string, MovBucket>();
  for (const r of movementsMonth) {
    const b = movByBoxMonth.get(r.cashBoxId) ?? emptyBucket();
    b[r.type] += Number(r._sum.amount ?? 0);
    movByBoxMonth.set(r.cashBoxId, b);
  }

  // ── Ensamble de las cajas con saldo + del mes
  const boxesOut = boxes.map((box) => {
    const paidAll = paidByBoxAll.get(box.id) ?? 0;
    const paidMonth = paidByBoxMonth.get(box.id) ?? 0;
    const mAll = movByBoxAll.get(box.id) ?? emptyBucket();
    const mMonth = movByBoxMonth.get(box.id) ?? emptyBucket();
    const balance =
      paidAll + mAll.INGRESO + mAll.TRANSFER_IN - mAll.EGRESO - mAll.TRANSFER_OUT;
    return {
      id: box.id,
      key: box.key,
      name: box.name,
      description: box.description,
      balance,
      month: {
        collections: paidMonth,
        ingresos: mMonth.INGRESO,
        egresos: mMonth.EGRESO,
        transfersIn: mMonth.TRANSFER_IN,
        transfersOut: mMonth.TRANSFER_OUT,
      },
    };
  });

  // ── Cobros pendientes: sumamos saldo de cada factura
  let pendingAmount = 0;
  for (const inv of pendingCollections) {
    const paid = inv.payments.reduce((a, p) => a + Number(p.amount), 0);
    const remainder = Number(inv.amount) - paid;
    if (remainder > 0) pendingAmount += remainder;
  }

  // ── Días promedio de cobro post-entrega
  const avgDaysRaw = avgDaysPost?.[0]?.avg_days;
  const avgCollectionDaysPostDelivery =
    avgDaysRaw !== null && avgDaysRaw !== undefined && Number.isFinite(Number(avgDaysRaw))
      ? Number(avgDaysRaw)
      : null;

  // ── Totales del panel de estadísticas contables (spec 4.4)
  const totalBalance = boxesOut.reduce((a, b) => a + b.balance, 0);
  const monthCollections = boxesOut.reduce(
    (a, b) => a + b.month.collections,
    0,
  );
  const monthEgresos = boxesOut.reduce((a, b) => a + b.month.egresos, 0);
  const monthBilling = Number(officialPaymentsMonth._sum.amount ?? 0);

  // ── Serie mensual de cobros (últimos 6 meses, completando meses vacíos)
  const MONTH_LABELS = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const revByKey = new Map<string, number>();
  for (const r of revenueSeriesRaw) {
    const d = new Date(r.month);
    revByKey.set(`${d.getFullYear()}-${d.getMonth()}`, Number(r.total) || 0);
  }
  const revenueSeries: Array<{ month: string; ingresos: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowReal.getFullYear(), nowReal.getMonth() - i, 1);
    revenueSeries.push({
      month: MONTH_LABELS[d.getMonth()],
      ingresos: revByKey.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
    });
  }

  return NextResponse.json({
    month: `${monthRef.getFullYear()}-${String(monthRef.getMonth() + 1).padStart(2, "0")}`,
    boxes: boxesOut,
    totals: {
      balance: totalBalance,
      monthCollections,
      monthEgresos,
      monthBilling,
      pendingAmount,
      avgCollectionDaysPostDelivery,
    },
    byInsurance: monthPaymentsByInsurance.map((r) => ({
      insurance: r.insurance_company ?? "Sin compañía",
      total: Number(r.total) || 0,
    })),
    revenueSeries,
  });
}
