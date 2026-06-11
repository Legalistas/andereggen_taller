/**
 * GET /api/stats
 *
 * Estadísticas simplificadas — dos bloques bien separados:
 *
 * 1. Cotizaciones (CRM)
 *    - totalYear / totalMonth: cantidad de presupuestos creados
 *    - byStage: conteo de Leads por cada estado del embudo
 *    - conversionRate: ganados / (ganados + perdidos) %
 *    - won / lost / closed (para el denominador del rate)
 *
 * 2. Producción (Repair)
 *    - byStage: cuántos vehículos hay AHORA en cada columna del Kanban (excl. archivado)
 *    - completedThisMonth: cuántas reparaciones se cerraron (archivado) este mes
 *
 * Sin filtros de período: el corte es siempre "mes actual" para los counters
 * mensuales y "año en curso" para los anuales.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  LeadStatus,
  RepairStatus,
} from "../../../../generated/prisma/client";

const LEAD_STAGES: LeadStatus[] = [
  "solicitud",
  "control",
  "enviado",
  "refuerzo",
  "pendientes_cobro",
  "ganado",
  "perdido",
];

// Estados activos del Kanban de producción (sin archivado)
const REPAIR_STAGES: RepairStatus[] = [
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
  "pendientes_cobro",
  "experiencia_cliente",
];

/**
 * Bucket por compañía de seguro. Las 3 principales se reconocen por
 * substring sobre el snapshot `Budget.vehicleInsurance` (case-insensitive).
 * "PARTICULARES" agrupa los presupuestos sin compañía cargada.
 * "OTROS" agrupa los presupuestos con compañía pero que no son ninguna
 * de las 3 principales.
 */
type InsuranceBucket =
  | "NORTE"
  | "SANCOR"
  | "SAN_CRIST"
  | "OTROS"
  | "PARTICULARES";

function bucketOf(insurance: string | null): InsuranceBucket {
  if (!insurance || insurance.trim() === "") return "PARTICULARES";
  const v = insurance.toLowerCase();
  if (v.includes("norte")) return "NORTE";
  if (v.includes("sancor")) return "SANCOR";
  if (v.includes("san crist") || v.includes("sancrist")) return "SAN_CRIST";
  return "OTROS";
}

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  // Mes de referencia para los counters mensuales. Formato YYYY-MM. Si no
  // viene, usa el mes actual. Permite que el frontend cambie entre meses
  // sin perder el resto del payload.
  const monthParam = url.searchParams.get("month");
  const now = new Date();
  let monthRef: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    monthRef = new Date(y, m - 1, 1);
  } else {
    monthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const startOfMonth = monthRef;
  const startOfNextMonth = new Date(
    monthRef.getFullYear(),
    monthRef.getMonth() + 1,
    1,
  );
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    budgetsYear,
    budgetsMonth,
    leadCounts,
    repairCounts,
    completedMonth,
    monthBudgets,
  ] = await Promise.all([
    prisma.budget.count({ where: { createdAt: { gte: startOfYear } } }),
    prisma.budget.count({
      where: {
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.repair.groupBy({ by: ["status"], _count: true }),
    prisma.repair.count({
      where: {
        status: "archivado",
        archivedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    // Para el desglose por compañía: traemos solo los snapshots de seguro y
    // status de los presupuestos del mes. Ampliaciones (extensionSuffix > 0)
    // quedan excluidas para no contar dos veces el mismo trabajo.
    prisma.budget.findMany({
      where: {
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
        extensionSuffix: 0,
      },
      select: { vehicleInsurance: true, status: true },
    }),
  ]);

  // ── Cotizaciones (Lead funnel)
  const leadByStatus = new Map<string, number>();
  for (const r of leadCounts) leadByStatus.set(r.status, r._count);

  const cotizacionesByStage = LEAD_STAGES.map((s) => ({
    stage: s,
    count: leadByStatus.get(s) ?? 0,
  }));

  const won = leadByStatus.get("ganado") ?? 0;
  const lost = leadByStatus.get("perdido") ?? 0;
  const closedTotal = won + lost;
  const conversionRate =
    closedTotal > 0 ? Math.round((won / closedTotal) * 100) : 0;

  // ── Producción (Repair)
  const repairByStatus = new Map<string, number>();
  for (const r of repairCounts) repairByStatus.set(r.status, r._count);

  const produccionByStage = REPAIR_STAGES.map((s) => ({
    stage: s,
    count: repairByStatus.get(s) ?? 0,
  }));

  const totalActive = produccionByStage.reduce((acc, x) => acc + x.count, 0);

  // ── Desglose mensual por compañía de seguro
  // Para cada bucket calculamos { total, aprobados } sobre los presupuestos
  // del mes (sin ampliaciones). "aprobado" = budget.status === "accepted".
  const buckets: InsuranceBucket[] = [
    "NORTE",
    "SANCOR",
    "SAN_CRIST",
    "OTROS",
    "PARTICULARES",
  ];
  const insuranceStats: Record<
    InsuranceBucket,
    { total: number; accepted: number }
  > = {
    NORTE: { total: 0, accepted: 0 },
    SANCOR: { total: 0, accepted: 0 },
    SAN_CRIST: { total: 0, accepted: 0 },
    OTROS: { total: 0, accepted: 0 },
    PARTICULARES: { total: 0, accepted: 0 },
  };
  for (const b of monthBudgets) {
    const key = bucketOf(b.vehicleInsurance);
    insuranceStats[key].total += 1;
    if (b.status === "accepted") insuranceStats[key].accepted += 1;
  }
  const byInsurance = buckets.map((key) => ({
    key,
    total: insuranceStats[key].total,
    accepted: insuranceStats[key].accepted,
  }));
  const monthTotal = byInsurance.reduce((a, b) => a + b.total, 0);
  const monthAccepted = byInsurance.reduce((a, b) => a + b.accepted, 0);

  return NextResponse.json({
    cotizaciones: {
      totalYear: budgetsYear,
      totalMonth: budgetsMonth,
      byStage: cotizacionesByStage,
      conversionRate,
      won,
      lost,
      closedTotal,
    },
    produccion: {
      totalActive,
      byStage: produccionByStage,
      completedThisMonth: completedMonth,
    },
    porCompania: {
      month: `${startOfMonth.getFullYear()}-${String(
        startOfMonth.getMonth() + 1,
      ).padStart(2, "0")}`,
      total: monthTotal,
      accepted: monthAccepted,
      byInsurance,
    },
  });
}
