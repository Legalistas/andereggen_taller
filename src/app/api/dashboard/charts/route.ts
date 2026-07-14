/**
 * GET /api/dashboard/charts
 *
 * Devuelve los 3 datasets que consume <ChartsSection> en el dashboard:
 *   - revenue:   ingresos por mes (últimos 6 meses, basado en Payment.paidAt)
 *   - services:  top 5 conceptos más usados en Budgets (BudgetConcept)
 *   - vehicles:  flujo de vehículos por mes (últimos 6 meses, Repair.enteredAt)
 *
 * spec 3.3 v2 · El gráfico "Flujo de Vehículos" pasa de vista semanal
 * (últimos 7 días por día de la semana) a vista semestral (últimos 6 meses).
 * La granularidad mensual permite ver estacionalidad real del taller que en
 * la vista semanal quedaba oculta.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const now = new Date();

  // ───── Revenue y Vehicles (últimos 6 meses) ─────
  // Inicio del mes actual menos 5 meses (=> 6 meses incluido el actual)
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [revenueRaw, topConcepts, vehiclesRaw] = await Promise.all([
    // Group by mes — usamos $queryRaw para date_trunc
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
    // spec 3.3 v2 · Flujo de vehículos por mes (semestral) — count de
    // ingresos físicos al taller agrupados por mes.
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

  // ── Revenue: completar los 6 meses (incluso si no hay pagos)
  const revenueByKey = new Map<string, number>();
  for (const r of revenueRaw) {
    const d = new Date(r.month);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    revenueByKey.set(key, Number(r.total) || 0);
  }
  const revenue: Array<{ month: string; ingresos: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    revenue.push({
      month: MONTH_LABELS[d.getMonth()],
      ingresos: revenueByKey.get(key) ?? 0,
    });
  }

  // ── Services: top 5 conceptos más usados
  const services = topConcepts.map((c) => ({
    servicio: CONCEPT_LABELS[c.category] ?? c.category,
    cantidad: c._count,
  }));

  // ── Vehicles: flujo por mes (últimos 6 meses, mismo eje que revenue)
  const vehiclesByKey = new Map<string, number>();
  for (const v of vehiclesRaw) {
    const d = new Date(v.month);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    vehiclesByKey.set(key, Number(v.count) || 0);
  }
  const vehicles: Array<{ mes: string; vehiculos: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    vehicles.push({
      mes: MONTH_LABELS[d.getMonth()],
      vehiculos: vehiclesByKey.get(key) ?? 0,
    });
  }

  return NextResponse.json({ revenue, services, vehicles });
}
