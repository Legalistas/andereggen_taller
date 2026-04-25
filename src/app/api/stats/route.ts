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

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    budgetsYear,
    budgetsMonth,
    leadCounts,
    repairCounts,
    completedMonth,
  ] = await Promise.all([
    prisma.budget.count({ where: { createdAt: { gte: startOfYear } } }),
    prisma.budget.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.repair.groupBy({ by: ["status"], _count: true }),
    prisma.repair.count({
      where: { status: "archivado", archivedAt: { gte: startOfMonth } },
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
  });
}
