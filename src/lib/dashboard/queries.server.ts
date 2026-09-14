/**
 * Perf audit · Funciones de query del dashboard, extraídas de los routes
 * `/api/dashboard/*` para poder invocarlas directamente desde la page RSC.
 *
 * Los routes siguen delegando a estas mismas funciones (evitamos que un
 * cliente externo pierda funcionalidad y garantizamos que ambos caminos
 * devuelvan el mismo shape).
 *
 * La ganancia: la page RSC llama a las 3 en `Promise.all` server-side
 * antes del render, y le pasa los datos como props a los componentes
 * cliente. Antes cada componente hacía su propio fetch post-hidratación
 * → 3 round-trips seriales en cascada. Ahora: 0.
 */

import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../generated/prisma/client";

// ─────────────────────────────────────────────────────────────
// /api/dashboard/stats
// ─────────────────────────────────────────────────────────────

const NOT_STARTED: RepairStatus[] = ["turno_asignado", "pendientes_repuestos"];
const IN_PROGRESS: RepairStatus[] = ["chapa", "pintura", "calidad"];
const READY: RepairStatus[] = ["pendientes_cobro", "experiencia_cliente"];
const IN_SHOP_STATUSES: RepairStatus[] = [...NOT_STARTED, ...IN_PROGRESS];

export type DashboardStats = {
  vehiclesInRepair: {
    total: number;
    breakdown: { not_started: number; in_progress: number; ready: number };
  };
  budgetsInProgress: {
    total: number;
    drafts: number;
    pendingApproval: number;
  };
  completedThisMonth: { count: number; amount: number };
  avgRepairDays: number | null;
  conversionRate: { rate: number; won: number; total: number };
};

export async function getDashboardStats(): Promise<DashboardStats> {
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
    prisma.$queryRaw<Array<{ avg_days: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("archivedAt" - "enteredAt")) / 86400) AS avg_days
      FROM "Repair"
      WHERE status = 'archivado'
        AND "enteredAt" IS NOT NULL
        AND "archivedAt" IS NOT NULL
        AND "archivedAt" > "enteredAt"
    `,
    prisma.lead.count({
      where: {
        status: "ganado",
        orderReceivedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    prisma.lead.count({
      where: {
        status: "perdido",
        updatedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
  ]);

  const repairByStatus = new Map<RepairStatus, number>();
  for (const r of repairCounts) repairByStatus.set(r.status, r._count);
  const sum = (statuses: RepairStatus[]) =>
    statuses.reduce((acc, s) => acc + (repairByStatus.get(s) ?? 0), 0);

  const notStarted = sum(NOT_STARTED);
  const inProgress = sum(IN_PROGRESS);
  const ready = sum(READY);
  const inShopTotal = sum(IN_SHOP_STATUSES);

  const totalBudgets = draftCount + sentCount;
  const completedAmount = Number(paymentsMonth._sum.amount ?? 0);

  const avgDaysRaw = avgDaysAgg?.[0]?.avg_days;
  const avgRepairDays =
    avgDaysRaw !== null &&
    avgDaysRaw !== undefined &&
    Number.isFinite(Number(avgDaysRaw))
      ? Number(avgDaysRaw)
      : null;

  const closedTotal = wonThisMonth + lostThisMonth;
  const rate =
    closedTotal > 0 ? Math.round((wonThisMonth / closedTotal) * 100) : 0;

  return {
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
  };
}

// ─────────────────────────────────────────────────────────────
// /api/dashboard/charts
// ─────────────────────────────────────────────────────────────

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

const CONCEPT_LABELS: Record<string, string> = {
  DESMONTAR: "Desmontar",
  DESMONTAR_Y_REPARAR: "Desmontar y reparar",
  DESMONTAR_Y_CAMBIAR: "Desmontar y cambiar",
  BANCADA_DE_ESTIRAMIENTO: "Bancada de estiramiento",
  DESABOLLAR: "Desabollar",
  CHAPA: "Chapa",
  PINTURA: "Pintura",
  MECANICA: "Mecánica",
  ALINEACION_BALANCEO: "Alineación / Balanceo",
  AIRE_ACONDICIONADO: "Aire acondicionado",
  AIRBAGS: "Airbags",
  COLOCACION_PARABRISAS: "Colocación parabrisas",
  COLOCACION_LUNETA: "Colocación luneta",
  PULIDO_COMPLETO: "Pulido completo",
  OTROS_ADICIONALES: "Otros adicionales",
};

export type DashboardCharts = {
  revenue: Array<{ month: string; ingresos: number }>;
  services: Array<{ servicio: string; cantidad: number }>;
  vehicles: Array<{ mes: string; vehiculos: number }>;
};

export async function getDashboardCharts(): Promise<DashboardCharts> {
  const now = new Date();
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [revenueRaw, topConcepts, vehiclesRaw] = await Promise.all([
    prisma.$queryRaw<Array<{ month: Date; total: number }>>`
      SELECT date_trunc('month', "paidAt")::timestamp AS month,
             SUM(amount)::float AS total
      FROM "Payment"
      WHERE "paidAt" >= ${sixMonthsStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.budgetConcept.groupBy({
      by: ["category"],
      _count: true,
      orderBy: { _count: { category: "desc" } },
      take: 5,
    }),
    prisma.$queryRaw<Array<{ month: Date; count: number }>>`
      SELECT date_trunc('month', "enteredAt")::timestamp AS month,
             COUNT(*)::int AS count
      FROM "Repair"
      WHERE "enteredAt" >= ${sixMonthsStart}
        AND "enteredAt" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const revenueByKey = new Map<string, number>();
  for (const r of revenueRaw) {
    const d = new Date(r.month);
    revenueByKey.set(`${d.getFullYear()}-${d.getMonth()}`, Number(r.total) || 0);
  }
  const revenue: Array<{ month: string; ingresos: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenue.push({
      month: MONTH_LABELS[d.getMonth()],
      ingresos: revenueByKey.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
    });
  }

  const services = topConcepts.map((c) => ({
    servicio: CONCEPT_LABELS[c.category] ?? c.category,
    cantidad: c._count,
  }));

  const vehiclesByKey = new Map<string, number>();
  for (const v of vehiclesRaw) {
    const d = new Date(v.month);
    vehiclesByKey.set(`${d.getFullYear()}-${d.getMonth()}`, Number(v.count) || 0);
  }
  const vehicles: Array<{ mes: string; vehiculos: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    vehicles.push({
      mes: MONTH_LABELS[d.getMonth()],
      vehiculos: vehiclesByKey.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
    });
  }

  return { revenue, services, vehicles };
}

// ─────────────────────────────────────────────────────────────
// /api/dashboard/activity
// ─────────────────────────────────────────────────────────────

const STATUS_GROUP: Record<
  RepairStatus,
  "completed" | "in-progress" | "pending"
> = {
  turno_a_asignar: "pending",
  turno_asignado: "pending",
  ingresado: "pending",
  pendientes_repuestos: "pending",
  chapa: "in-progress",
  pintura: "in-progress",
  calidad: "in-progress",
  pendientes_cobro: "completed",
  experiencia_cliente: "completed",
  archivado: "completed",
};

const STATUS_LABEL: Record<RepairStatus, string> = {
  turno_a_asignar: "Turno a asignar",
  turno_asignado: "Turno asignado",
  ingresado: "Ingresado",
  pendientes_repuestos: "Pend. repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pend. cobro",
  experiencia_cliente: "Experiencia cliente",
  archivado: "Archivado",
};

export type DashboardActivityItem = {
  id: string;
  vehicle: string;
  plate: string;
  service: string;
  mechanic: string;
  status: "completed" | "in-progress" | "pending";
  statusLabel: string;
  time: string;
};

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 60) return `Hace ${Math.max(1, min)} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Hace ${hr} ${hr === 1 ? "hora" : "horas"}`;
  const days = Math.round(hr / 24);
  if (days < 7) return `Hace ${days} ${days === 1 ? "día" : "días"}`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export async function getDashboardActivity(): Promise<DashboardActivityItem[]> {
  const repairs = await prisma.repair.findMany({
    take: 8,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleYear: true,
      vehicleDomain: true,
      reason: true,
      assignedMechanic: { select: { name: true } },
    },
  });

  return repairs.map((r) => {
    const vehicle = [r.vehicleBrand, r.vehicleModel, r.vehicleYear]
      .filter((v) => v && v !== "S/D")
      .join(" ")
      .trim();
    return {
      id: r.id,
      vehicle: vehicle || "Vehículo S/D",
      plate:
        r.vehicleDomain && r.vehicleDomain !== "S/D" ? r.vehicleDomain : "—",
      service: r.reason ?? STATUS_LABEL[r.status],
      mechanic: r.assignedMechanic?.name ?? "Sin asignar",
      status: STATUS_GROUP[r.status],
      statusLabel: STATUS_LABEL[r.status],
      time: relativeTime(r.updatedAt),
    };
  });
}
