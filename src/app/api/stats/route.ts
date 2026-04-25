import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  BudgetStatus,
  LeadStatus,
} from "../../../../generated/prisma/client";

/**
 * GET /api/stats?dateFrom=ISO&dateTo=ISO
 *
 * Cálculo server-side de todas las métricas que consume /estadisticas.
 * Si no vienen fechas, se asume el último año completo.
 * Devuelve:
 *   - kpis: totales principales (presupuestos, conversión, pipeline $, facturado, leads activos, ticket promedio)
 *   - leadFunnel: conteo por cada estado de lead
 *   - budgetStatus: conteo + monto por cada estado de presupuesto
 *   - monthlySeries: últimos 6 meses → { month, emitted, accepted, acceptedAmount }
 *   - topCustomers: top 5 clientes por monto aceptado (en el período)
 *   - topParts: top 10 repuestos con más unidades consumidas (OUT movements)
 *   - leadSources: conteo de leads por fuente
 */

type MonthBucket = {
  month: string; // YYYY-MM
  label: string; // "abr 25"
  emitted: number;
  accepted: number;
  acceptedAmount: number;
};

const ACTIVE_LEAD_STATUSES: LeadStatus[] = [
  "solicitud",
  "control",
  "enviado",
  "refuerzo",
  "pendientes_cobro",
];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setMonth(defaultFrom.getMonth() - 6);

  const dateFrom = url.searchParams.get("dateFrom")
    ? new Date(url.searchParams.get("dateFrom") as string)
    : defaultFrom;
  const dateTo = url.searchParams.get("dateTo")
    ? new Date(url.searchParams.get("dateTo") as string)
    : now;

  const periodWhere = { createdAt: { gte: dateFrom, lte: dateTo } };

  // ── Queries en paralelo ───────────────────────────────────────
  const [
    leadCounts,
    activeLeadsTotal,
    budgetGrouped,
    monthlyRaw,
    topCustomersRaw,
    topPartsRaw,
    leadSourcesRaw,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: periodWhere,
      _count: true,
    }),
    prisma.lead.count({
      where: { status: { in: ACTIVE_LEAD_STATUSES } },
    }),
    prisma.budget.groupBy({
      by: ["status"],
      where: periodWhere,
      _count: true,
      _sum: { grandTotal: true },
    }),
    prisma.$queryRaw<
      Array<{
        month: string;
        emitted: bigint;
        accepted: bigint;
        accepted_amount: string;
      }>
    >`
            SELECT
              to_char("createdAt", 'YYYY-MM')                                       AS month,
              COUNT(*)::bigint                                                      AS emitted,
              COUNT(*) FILTER (WHERE status = 'accepted')::bigint                   AS accepted,
              COALESCE(SUM("grandTotal") FILTER (WHERE status = 'accepted'), 0)::text AS accepted_amount
            FROM "Budget"
            WHERE "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
            GROUP BY to_char("createdAt", 'YYYY-MM')
            ORDER BY month ASC
        `,
    prisma.budget.groupBy({
      by: ["customerEmail", "customerName"],
      where: { ...periodWhere, status: "accepted" },
      _count: true,
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: "desc" } },
      take: 5,
    }),
    prisma.partMovement.groupBy({
      by: ["partId"],
      where: { ...periodWhere, type: "OUT" },
      _sum: { qty: true },
      _count: true,
      orderBy: { _sum: { qty: "desc" } },
      take: 10,
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: periodWhere,
      _count: true,
    }),
  ]);

  // Resolver nombres de repuestos para topParts
  const partIds = topPartsRaw.map((p) => p.partId);
  const parts =
    partIds.length > 0
      ? await prisma.part.findMany({
          where: { id: { in: partIds } },
          select: { id: true, name: true, sku: true, salePrice: true },
        })
      : [];
  const partById = Object.fromEntries(parts.map((p) => [p.id, p]));

  // ── Transformaciones ──────────────────────────────────────────
  const leadFunnel: Record<LeadStatus, number> = {
    solicitud: 0,
    control: 0,
    enviado: 0,
    refuerzo: 0,
    pendientes_cobro: 0,
    ganado: 0,
    perdido: 0,
  };
  for (const row of leadCounts) leadFunnel[row.status] = row._count;

  const budgetStatus: Record<BudgetStatus, { count: number; amount: number }> =
    {
      draft: { count: 0, amount: 0 },
      sent: { count: 0, amount: 0 },
      accepted: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      expired: { count: 0, amount: 0 },
    };
  for (const row of budgetGrouped) {
    budgetStatus[row.status] = {
      count: row._count,
      amount: Number(row._sum.grandTotal ?? 0),
    };
  }

  // Serie mensual — completa los meses faltantes con ceros para que el gráfico no tenga gaps
  const monthlySeries = buildMonthlyBuckets(dateFrom, dateTo, monthlyRaw);

  const topCustomers = topCustomersRaw.map((r) => ({
    email: r.customerEmail,
    name: r.customerName,
    count: r._count,
    amount: Number(r._sum.grandTotal ?? 0),
  }));

  const topParts = topPartsRaw.map((r) => {
    const part = partById[r.partId];
    return {
      id: r.partId,
      name: part?.name ?? "—",
      sku: part?.sku ?? null,
      qtyOut: Number(r._sum.qty ?? 0),
      movements: r._count,
      salePrice: Number(part?.salePrice ?? 0),
    };
  });

  const leadSources = leadSourcesRaw
    .map((r) => ({ key: r.source ?? "(sin fuente)", count: r._count }))
    .sort((a, b) => b.count - a.count);

  // KPIs
  const totalBudgets = Object.values(budgetStatus).reduce(
    (a, b) => a + b.count,
    0,
  );
  const acceptedCount = budgetStatus.accepted.count;
  const pipeline = budgetStatus.sent.amount;
  const invoiced = budgetStatus.accepted.amount;
  const conversionRate =
    totalBudgets === 0 ? 0 : Math.round((acceptedCount / totalBudgets) * 100);
  const avgTicket =
    acceptedCount === 0 ? 0 : Math.round(invoiced / acceptedCount);

  return NextResponse.json({
    period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    kpis: {
      totalBudgets,
      conversionRate,
      pipeline,
      invoiced,
      activeLeads: activeLeadsTotal,
      avgTicket,
    },
    leadFunnel,
    budgetStatus,
    monthlySeries,
    topCustomers,
    topParts,
    leadSources,
  });
}

function buildMonthlyBuckets(
  from: Date,
  to: Date,
  rows: Array<{
    month: string;
    emitted: bigint;
    accepted: bigint;
    accepted_amount: string;
  }>,
): MonthBucket[] {
  const map = new Map(rows.map((r) => [r.month, r]));
  const result: MonthBucket[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const fmtLabel = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
  });

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    const row = map.get(key);
    result.push({
      month: key,
      label: fmtLabel.format(cursor).replace(/\s+/g, " "),
      emitted: row ? Number(row.emitted) : 0,
      accepted: row ? Number(row.accepted) : 0,
      acceptedAmount: row ? Number(row.accepted_amount) : 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}
