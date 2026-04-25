import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  BudgetStatus,
  ConceptCategory,
  ConceptType,
  Prisma,
} from "../../../../../generated/prisma/client";

/**
 * GET /api/reports/services
 * Query:
 *   dateFrom, dateTo   — rango (default: últimos 6 meses)
 *   scope = accepted|all   — "accepted" (default) filtra a presupuestos aceptados.
 *
 * Devuelve:
 *   - kpis: totalLaborAmount, totalPartsAmount, laborShare, topCategoryKey, avgTicketMO
 *   - byCategory: array con { key, type, count, totalAmount, avgAmount, avgUnits?, avgUnitValue? }
 *   - byType: { DESCRIPTIVO: {...}, UNIDADES: {...}, FIJO: {...} }
 *   - monthlyByType: serie mensual con montos por type
 *   - topCategories: top 10 por monto (solo no-descriptivas, porque las descriptivas no suman MO)
 */
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

  const scope = (url.searchParams.get("scope") ?? "accepted") as
    | "accepted"
    | "all";

  // Filtro de budget según scope
  const budgetStatuses: BudgetStatus[] =
    scope === "accepted"
      ? ["accepted"]
      : ["draft", "sent", "accepted", "rejected", "expired"];
  const dateKey = scope === "accepted" ? "acceptedAt" : "createdAt";

  const budgetWhereInput: Prisma.BudgetWhereInput = {
    status: { in: budgetStatuses },
    [dateKey]: { gte: dateFrom, lte: dateTo },
  };

  // ── Queries ────────────────────────────────────────────────
  const [concepts, partsAggregate, budgetIds] = await Promise.all([
    prisma.budgetConcept.findMany({
      where: { budget: budgetWhereInput },
      select: {
        id: true,
        category: true,
        type: true,
        subtotal: true,
        units: true,
        unitValue: true,
        budget: {
          select: {
            id: true,
            [dateKey]: true,
            createdAt: true,
            acceptedAt: true,
          },
        },
      },
    }),
    prisma.budgetPart.aggregate({
      where: { budget: budgetWhereInput },
      _sum: { subtotal: true },
      _count: true,
    }),
    prisma.budget.findMany({
      where: budgetWhereInput,
      select: { id: true },
    }),
  ]);

  const budgetCount = budgetIds.length;

  // ── byCategory ─────────────────────────────────────────────
  type CategoryAggregation = {
    key: ConceptCategory;
    type: ConceptType;
    count: number;
    totalAmount: number;
    unitsSum: number;
    unitsCount: number; // cuántos tenían units
    unitValueSum: number;
    unitValueCount: number;
  };

  const byCategoryMap = new Map<ConceptCategory, CategoryAggregation>();
  let totalLaborAmount = 0;

  for (const c of concepts) {
    const subtotal = Number(c.subtotal);
    totalLaborAmount += subtotal;

    let entry = byCategoryMap.get(c.category);
    if (!entry) {
      entry = {
        key: c.category,
        type: c.type,
        count: 0,
        totalAmount: 0,
        unitsSum: 0,
        unitsCount: 0,
        unitValueSum: 0,
        unitValueCount: 0,
      };
      byCategoryMap.set(c.category, entry);
    }
    entry.count += 1;
    entry.totalAmount += subtotal;
    if (c.units != null) {
      entry.unitsSum += Number(c.units);
      entry.unitsCount += 1;
    }
    if (c.unitValue != null) {
      entry.unitValueSum += Number(c.unitValue);
      entry.unitValueCount += 1;
    }
  }

  const byCategory = Array.from(byCategoryMap.values())
    .map((e) => ({
      key: e.key,
      type: e.type,
      count: e.count,
      totalAmount: e.totalAmount,
      avgAmount: e.count === 0 ? 0 : e.totalAmount / e.count,
      avgUnits: e.unitsCount === 0 ? null : e.unitsSum / e.unitsCount,
      avgUnitValue:
        e.unitValueCount === 0 ? null : e.unitValueSum / e.unitValueCount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // ── byType ─────────────────────────────────────────────────
  const byType: Record<ConceptType, { count: number; amount: number }> = {
    DESCRIPTIVO: { count: 0, amount: 0 },
    UNIDADES: { count: 0, amount: 0 },
    FIJO: { count: 0, amount: 0 },
  };
  for (const c of concepts) {
    byType[c.type].count += 1;
    byType[c.type].amount += Number(c.subtotal);
  }

  // ── Serie mensual por tipo ─────────────────────────────────
  const monthMap = new Map<
    string,
    {
      month: string;
      label: string;
      DESCRIPTIVO: number;
      UNIDADES: number;
      FIJO: number;
      partsAmount: number;
    }
  >();
  const fmtLabel = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
  });

  const cursor = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1);
  const endCursor = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);
  while (cursor <= endCursor) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, {
      month: key,
      label: fmtLabel.format(cursor),
      DESCRIPTIVO: 0,
      UNIDADES: 0,
      FIJO: 0,
      partsAmount: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const c of concepts) {
    const date = (c.budget as Record<string, unknown>)[dateKey] as Date | null;
    if (!date) continue;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month: key,
        label: fmtLabel.format(d),
        DESCRIPTIVO: 0,
        UNIDADES: 0,
        FIJO: 0,
        partsAmount: 0,
      });
    }
    const row = monthMap.get(key)!;
    row[c.type] += Number(c.subtotal);
  }

  // Repuestos por mes (budget.dateKey)
  const budgetPartsWithDate = await prisma.budgetPart.findMany({
    where: { budget: budgetWhereInput },
    select: {
      subtotal: true,
      budget: { select: { [dateKey]: true } },
    },
  });
  for (const p of budgetPartsWithDate) {
    const date = (p.budget as Record<string, unknown>)[dateKey] as Date | null;
    if (!date) continue;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) continue;
    monthMap.get(key)!.partsAmount += Number(p.subtotal);
  }

  const monthlyByType = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  // ── KPIs ───────────────────────────────────────────────────
  const totalPartsAmount = Number(partsAggregate._sum.subtotal ?? 0);
  const grandTotal = totalLaborAmount + totalPartsAmount;
  const laborShare =
    grandTotal === 0 ? 0 : Math.round((totalLaborAmount / grandTotal) * 100);
  const topCategory = byCategory.find((c) => c.type !== "DESCRIPTIVO") ?? null;
  const avgTicketMO = budgetCount === 0 ? 0 : totalLaborAmount / budgetCount;

  return NextResponse.json({
    period: { from: dateFrom.toISOString(), to: dateTo.toISOString(), scope },
    kpis: {
      totalLaborAmount,
      totalPartsAmount,
      laborShare,
      topCategoryKey: topCategory?.key ?? null,
      topCategoryAmount: topCategory?.totalAmount ?? 0,
      avgTicketMO,
      budgetCount,
      conceptCount: concepts.length,
      partsCount: partsAggregate._count,
    },
    byCategory,
    byType,
    monthlyByType,
    topCategories: byCategory
      .filter((c) => c.type !== "DESCRIPTIVO")
      .slice(0, 10),
  });
}
