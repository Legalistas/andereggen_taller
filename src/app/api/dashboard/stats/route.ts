import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../../../generated/prisma/client";

/**
 * GET /api/dashboard/stats
 *
 * KPIs principales del dashboard:
 *   1. Vehículos en reparación (basado en Repair, excluyendo archivado)
 *   2. Cotizaciones en curso (Budget draft + sent)
 *   3. Reparaciones completadas en el mes (Repair archivado con archivedAt este mes)
 *   4. Tiempo promedio de reparación (entre enteredAt y archivedAt, repairs archivados)
 *   5. Tasa de conversión (Lead ganados / (ganados + perdidos))
 *
 * Mapeo de RepairStatus a etapas:
 *   not_started: turno_asignado, pendientes_repuestos
 *   in_progress: chapa, pintura, calidad
 *   ready:       pendientes_cobro, experiencia_cliente
 *   archivado:   excluido del total "en reparación"
 *
 * NOTA: 'ingresado' fue removido del flujo del Kanban. El enum value sigue
 * existiendo pero no debería haber nuevas Repairs con ese status.
 */

const NOT_STARTED: RepairStatus[] = ["turno_asignado", "pendientes_repuestos"];
const IN_PROGRESS: RepairStatus[] = ["chapa", "pintura", "calidad"];
const READY: RepairStatus[] = ["pendientes_cobro", "experiencia_cliente"];

// spec 2.2 v2 · "En taller ahora" solo cuenta Turno Asignado → Calidad
// (inclusive). Ready (pendientes_cobro / experiencia_cliente) queda excluido:
// son vehículos entregables, no están más "en taller".
const IN_SHOP_STATUSES: RepairStatus[] = [...NOT_STARTED, ...IN_PROGRESS];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    repairCounts,
    draftCount,
    sentCount,
    completedMonthCount,
    paymentsMonth,
    avgDaysAgg,
    wonThisMonth,
    lostThisMonth,
  ] = await Promise.all([
    prisma.repair.groupBy({ by: ["status"], _count: true }),
    prisma.budget.count({ where: { status: "draft" } }),
    prisma.budget.count({ where: { status: "sent" } }),
    prisma.repair.count({
      where: { status: "archivado", archivedAt: { gte: startOfMonth } },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    // Promedio de días entre enteredAt y archivedAt (Repairs archivados con
    // ambas fechas válidas). Postgres-only — usamos $queryRaw.
    prisma.$queryRaw<Array<{ avg_days: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("archivedAt" - "enteredAt")) / 86400) AS avg_days
      FROM "Repair"
      WHERE status = 'archivado'
        AND "enteredAt" IS NOT NULL
        AND "archivedAt" IS NOT NULL
        AND "archivedAt" > "enteredAt"
    `,
    // spec 1.1 + 3.1 v2 · Ganados del mes imputados por orderReceivedAt
    // (fecha en que se recibió la orden), no por createdAt del lead.
    prisma.lead.count({
      where: {
        status: "ganado",
        orderReceivedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    // Perdidos del mes imputados por updatedAt (momento de la transición).
    prisma.lead.count({
      where: {
        status: "perdido",
        updatedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
  ]);

  // ── KPI 1: Vehículos en taller (spec 2.2 v2 — solo Turno Asignado → Calidad)
  const repairByStatus = new Map<RepairStatus, number>();
  for (const r of repairCounts) repairByStatus.set(r.status, r._count);
  const sum = (statuses: RepairStatus[]) =>
    statuses.reduce((acc, s) => acc + (repairByStatus.get(s) ?? 0), 0);

  const notStarted = sum(NOT_STARTED);
  const inProgress = sum(IN_PROGRESS);
  const ready = sum(READY);
  const inShopTotal = sum(IN_SHOP_STATUSES);

  // ── KPI 2: Cotizaciones en curso
  const totalBudgets = draftCount + sentCount;

  // ── KPI 3: Completadas este mes (count + monto cobrado)
  const completedAmount = Number(paymentsMonth._sum.amount ?? 0);

  // ── KPI 4: Tiempo promedio
  const avgDaysRaw = avgDaysAgg?.[0]?.avg_days;
  const avgRepairDays =
    avgDaysRaw !== null && avgDaysRaw !== undefined && Number.isFinite(Number(avgDaysRaw))
      ? Number(avgDaysRaw)
      : null;

  // ── KPI 5: Tasa de conversión mensual
  const closedTotal = wonThisMonth + lostThisMonth;
  const rate =
    closedTotal > 0 ? Math.round((wonThisMonth / closedTotal) * 100) : 0;

  return NextResponse.json({
    vehiclesInRepair: {
      total: inShopTotal,
      breakdown: { not_started: notStarted, in_progress: inProgress, ready },
    },
    budgetsInProgress: {
      total: totalBudgets,
      drafts: draftCount,
      pendingApproval: sentCount,
    },
    completedThisMonth: {
      count: completedMonthCount,
      amount: completedAmount,
    },
    avgRepairDays,
    conversionRate: { rate, won: wonThisMonth, total: closedTotal },
  });
}
