import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/stats
 *
 * KPIs principales del módulo de Estadísticas (Dashboard). Spec:
 *  1. Vehículos en reparación actualmente (total + desglose por sub-estado de pago)
 *  2. Cotizaciones en curso (draft + sent)
 *  3. Reparaciones completadas en el mes
 *  4. Tiempo promedio de reparación
 *  5. Tasa de conversión (cotizaciones ganadas / total decididas)
 *
 * Como el dominio actual no tiene un modelo "Repair" separado, tratamos a los
 * Budgets con status=accepted como reparaciones en curso, y derivamos el
 * sub-estado y la "finalización" desde los Payments asociados:
 *   - sin pagos                       → Sin iniciar
 *   - pagos parciales (< grandTotal)  → En proceso
 *   - pagos ≥ grandTotal              → Lista / completada
 */
export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // ── 1+3+4: todos los budgets accepted con sus pagos ─────────────
  // Traemos solo los campos necesarios para calcular local (evita N+1).
  const acceptedBudgets = await prisma.budget.findMany({
    where: { status: "accepted" },
    select: {
      id: true,
      grandTotal: true,
      acceptedAt: true,
      updatedAt: true,
      payments: { select: { amount: true, paidAt: true } },
    },
  });

  type RepairState = "not_started" | "in_progress" | "ready";
  const classify = (b: (typeof acceptedBudgets)[number]): RepairState => {
    const total = Number(b.grandTotal);
    const paid = b.payments.reduce((a, p) => a + Number(p.amount), 0);
    if (paid <= 0) return "not_started";
    if (paid < total) return "in_progress";
    return "ready";
  };

  const vehiclesBreakdown = { not_started: 0, in_progress: 0, ready: 0 };
  const completedThisMonth: typeof acceptedBudgets = [];
  const repairDurations: number[] = [];

  for (const b of acceptedBudgets) {
    const state = classify(b);
    vehiclesBreakdown[state] += 1;

    if (state === "ready") {
      // Fecha de "completado" = último pago que llevó el total ≥ grandTotal.
      const lastPaidAt = b.payments.reduce<Date | null>((acc, p) => {
        const d = p.paidAt;
        return !acc || d > acc ? d : acc;
      }, null);

      // Tiempo de reparación — solo si tenemos acceptedAt y último pago válido.
      if (b.acceptedAt && lastPaidAt && lastPaidAt >= b.acceptedAt) {
        const days =
          (lastPaidAt.getTime() - b.acceptedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        repairDurations.push(days);
      }

      if (lastPaidAt && lastPaidAt >= startOfMonth && lastPaidAt < endOfMonth) {
        completedThisMonth.push(b);
      }
    }
  }

  const vehiclesInRepair = {
    total:
      vehiclesBreakdown.not_started +
      vehiclesBreakdown.in_progress +
      vehiclesBreakdown.ready,
    breakdown: vehiclesBreakdown,
  };

  const completedThisMonthAmount = completedThisMonth.reduce(
    (a, b) => a + Number(b.grandTotal),
    0,
  );

  const avgRepairDays =
    repairDurations.length === 0
      ? null
      : repairDurations.reduce((a, n) => a + n, 0) / repairDurations.length;

  // ── 2: cotizaciones en curso ────────────────────────────────────
  const [draftCount, sentCount] = await Promise.all([
    prisma.budget.count({ where: { status: "draft" } }),
    prisma.budget.count({ where: { status: "sent" } }),
  ]);

  // ── 5: tasa de conversión ───────────────────────────────────────
  // Denominador: cotizaciones que ya fueron decididas (no sumamos drafts).
  const [acceptedTotal, rejectedTotal, expiredTotal, sentTotalForRate] =
    await Promise.all([
      prisma.budget.count({ where: { status: "accepted" } }),
      prisma.budget.count({ where: { status: "rejected" } }),
      prisma.budget.count({ where: { status: "expired" } }),
      prisma.budget.count({ where: { status: "sent" } }),
    ]);

  const conversionDenom =
    acceptedTotal + rejectedTotal + expiredTotal + sentTotalForRate;
  const conversionRate =
    conversionDenom === 0
      ? 0
      : Math.round((acceptedTotal / conversionDenom) * 100);

  return NextResponse.json({
    vehiclesInRepair,
    budgetsInProgress: {
      total: draftCount + sentCount,
      drafts: draftCount,
      pendingApproval: sentCount,
    },
    completedThisMonth: {
      count: completedThisMonth.length,
      amount: completedThisMonthAmount,
    },
    avgRepairDays,
    conversionRate: {
      rate: conversionRate,
      won: acceptedTotal,
      total: conversionDenom,
    },
  });
}
