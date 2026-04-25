import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports/customers
 * Query:
 *   dateFrom, dateTo — rango (default: últimos 6 meses). El rango se usa
 *                     para filtrar leads/budgets del cliente, no para excluir
 *                     clientes viejos.
 *   search          — nombre/email/patente
 *   segment         — frequent | new | at_risk | moroso | all (default: all)
 *
 * Segmentos:
 *   frequent  → clientes con 2+ leads en el período
 *   new       → cliente creado dentro del período
 *   at_risk   → sin actividad (sin leads/budgets/payments) hace más de 180 días
 *   moroso    → con saldo pendiente (budget accepted con cobros < total)
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
  const search = url.searchParams.get("search")?.trim() ?? "";
  const segment = (url.searchParams.get("segment") ?? "all") as
    | "all"
    | "frequent"
    | "new"
    | "at_risk"
    | "moroso";

  const atRiskCutoff = new Date(now.getTime() - 180 * 86400_000);

  // Traemos todos los customers que hayan tenido actividad alguna vez
  // (simplifica la lógica; los inactivos igual aparecen si tuvieron algo).
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { dni: { contains: search } },
          ],
        }
      : undefined,
    include: {
      leads: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          status: true,
        },
      },
      _count: { select: { leads: true, vehicles: true } },
    },
  });

  // Traemos budgets y payments por separado para agregar
  const customerEmails = customers.map((c) => c.email);
  const [budgets, payments] = await Promise.all([
    prisma.budget.findMany({
      where: { customerEmail: { in: customerEmails } },
      select: {
        id: true,
        customerEmail: true,
        status: true,
        grandTotal: true,
        acceptedAt: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      where: { budget: { customerEmail: { in: customerEmails } } },
      select: {
        amount: true,
        paidAt: true,
        budget: { select: { customerEmail: true, id: true, grandTotal: true } },
      },
    }),
  ]);

  // Indexar por email
  const budgetsByEmail = new Map<string, typeof budgets>();
  for (const b of budgets) {
    const list = budgetsByEmail.get(b.customerEmail) ?? [];
    list.push(b);
    budgetsByEmail.set(b.customerEmail, list);
  }
  const paymentsByEmail = new Map<string, typeof payments>();
  for (const p of payments) {
    const email = p.budget.customerEmail;
    const list = paymentsByEmail.get(email) ?? [];
    list.push(p);
    paymentsByEmail.set(email, list);
  }

  type Segment = "new" | "frequent" | "regular" | "at_risk" | "moroso";

  // Computar filas
  const rows = customers.map((c) => {
    const myBudgets = budgetsByEmail.get(c.email) ?? [];
    const myPayments = paymentsByEmail.get(c.email) ?? [];

    // Leads en el período filtrado
    const leadsInRange = c.leads.filter((l) => {
      const d = new Date(l.createdAt);
      return d >= dateFrom && d <= dateTo;
    });

    const budgetsInRange = myBudgets.filter((b) => {
      const d = new Date(b.createdAt);
      return d >= dateFrom && d <= dateTo;
    });

    const accepted = myBudgets.filter((b) => b.status === "accepted");

    // Totales facturados/cobrados (sobre todos los budgets, no solo período —
    // porque "CLV" es histórico; el período filtra conteos no acumulados)
    const totalBilled = accepted.reduce((a, b) => a + Number(b.grandTotal), 0);
    const totalCollected = myPayments.reduce((a, p) => a + Number(p.amount), 0);
    const pendingBalance = Math.max(0, totalBilled - totalCollected);

    const budgetCount = myBudgets.length;
    const acceptedCount = accepted.length;
    const conversionRate =
      budgetCount === 0 ? 0 : Math.round((acceptedCount / budgetCount) * 100);
    const avgTicket = acceptedCount === 0 ? 0 : totalBilled / acceptedCount;

    // Última interacción (max entre última lead update, último budget, último pago)
    const lastLead = c.leads.reduce<Date | null>(
      (latest, l) =>
        !latest || new Date(l.updatedAt) > latest
          ? new Date(l.updatedAt)
          : latest,
      null,
    );
    const lastBudget = myBudgets.reduce<Date | null>(
      (latest, b) =>
        !latest || new Date(b.createdAt) > latest
          ? new Date(b.createdAt)
          : latest,
      null,
    );
    const lastPayment = myPayments.reduce<Date | null>(
      (latest, p) =>
        !latest || new Date(p.paidAt) > latest ? new Date(p.paidAt) : latest,
      null,
    );
    const lastActivityAt = [lastLead, lastBudget, lastPayment]
      .filter((d): d is Date => d !== null)
      .reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);

    // Segmento
    let seg: Segment = "regular";
    if (new Date(c.createdAt) >= dateFrom) seg = "new";
    else if (leadsInRange.length >= 2) seg = "frequent";
    if (pendingBalance > 0)
      seg = "moroso"; // moroso tiene prioridad sobre los demás
    else if (lastActivityAt && lastActivityAt < atRiskCutoff) seg = "at_risk";

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      dni: c.dni,
      createdAt: c.createdAt.toISOString(),
      vehicleCount: c._count.vehicles,
      leadsTotal: c._count.leads,
      leadsInRange: leadsInRange.length,
      budgetsInRange: budgetsInRange.length,
      budgetCount,
      acceptedCount,
      conversionRate,
      totalBilled,
      totalCollected,
      pendingBalance,
      avgTicket,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      firstContactAt:
        lastLead && c.leads.length > 0
          ? c.leads
              .reduce(
                (earliest, l) =>
                  new Date(l.createdAt) < new Date(earliest)
                    ? l.createdAt
                    : earliest,
                c.leads[0].createdAt,
              )
              .toISOString()
          : null,
      segment: seg,
    };
  });

  // Filtro de segmento
  const filtered =
    segment === "all" ? rows : rows.filter((r) => r.segment === segment);

  // Solo mostrar clientes con alguna actividad en el período (o que sean nuevos)
  // si el user no pidió segment explícito
  const active = filtered.filter(
    (r) =>
      r.leadsInRange > 0 ||
      r.budgetsInRange > 0 ||
      r.segment === "new" ||
      r.segment === "moroso" ||
      r.segment === "at_risk",
  );

  // Ordenar por total facturado desc
  active.sort((a, b) => b.totalBilled - a.totalBilled);

  // ── KPIs ────────────────────────────────────────────────────
  const newInPeriod = rows.filter((r) => r.segment === "new").length;
  const morosos = rows.filter((r) => r.pendingBalance > 0).length;
  const activeTotal = rows.filter((r) => r.leadsInRange > 0).length;
  const withBilling = rows.filter((r) => r.totalBilled > 0);
  const avgCLV =
    withBilling.length === 0
      ? 0
      : withBilling.reduce((a, r) => a + r.totalBilled, 0) / withBilling.length;
  const avgTicketOverall =
    withBilling.length === 0
      ? 0
      : withBilling.reduce((a, r) => a + r.avgTicket, 0) / withBilling.length;

  // ── Nuevos por mes ──────────────────────────────────────────
  const monthMap = new Map<
    string,
    { month: string; label: string; newCount: number }
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
      newCount: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const c of customers) {
    const d = new Date(c.createdAt);
    if (d < dateFrom || d > dateTo) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) continue;
    monthMap.get(key)!.newCount += 1;
  }
  const newByMonth = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  // ── Top 10 por facturación ──────────────────────────────────
  const topByBilled = [...rows]
    .filter((r) => r.totalBilled > 0)
    .sort((a, b) => b.totalBilled - a.totalBilled)
    .slice(0, 10);

  return NextResponse.json({
    period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    kpis: {
      totalCustomers: rows.length,
      activeTotal,
      newInPeriod,
      morosos,
      avgCLV,
      avgTicket: avgTicketOverall,
    },
    customers: active,
    newByMonth,
    topByBilled,
  });
}
