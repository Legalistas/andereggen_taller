import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { paymentStatusFor } from "@/lib/payments";
import type { PaymentMethod, Prisma } from "../../../../../generated/prisma/client";

/**
 * GET /api/reports/income
 * Query: dateFrom, dateTo, search (cliente/patente), status (paid|partial|pending)
 *
 * Devuelve:
 *  - kpis: facturado (total accepted), cobrado (sum payments), porCobrar,
 *          tasaCobranza, ventas del mes actual
 *  - items: lista de budgets accepted con totales paid/balance y estado
 *  - monthlySeries: cobrado vs pendiente por mes
 *  - byMethod: suma por método de pago
 *  - topCustomers: top 5 por monto cobrado
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
    const statusFilter = url.searchParams.get("status") as
        | "paid"
        | "partial"
        | "pending"
        | null;

    // ── Budgets accepted en el período ────────────────────────────
    const budgetWhere: Prisma.BudgetWhereInput = {
        status: "accepted",
        acceptedAt: { gte: dateFrom, lte: dateTo },
        ...(search && {
            OR: [
                { customerName: { contains: search, mode: "insensitive" } },
                { customerEmail: { contains: search, mode: "insensitive" } },
                { vehicleDomain: { contains: search, mode: "insensitive" } },
            ],
        }),
    };

    const budgets = await prisma.budget.findMany({
        where: budgetWhere,
        orderBy: { acceptedAt: "desc" },
        include: {
            payments: {
                select: { id: true, amount: true, paidAt: true, method: true },
            },
        },
    });

    let itemsAll = budgets.map((b) => {
        const paid = b.payments.reduce((a, p) => a + Number(p.amount), 0);
        const total = Number(b.grandTotal);
        const balance = Math.max(0, total - paid);
        return {
            id: b.id,
            leadId: b.leadId,
            number: b.number,
            customerName: b.customerName,
            customerEmail: b.customerEmail,
            vehicleBrand: b.vehicleBrand,
            vehicleModel: b.vehicleModel,
            vehicleDomain: b.vehicleDomain,
            acceptedAt: b.acceptedAt,
            grandTotal: total,
            paid,
            balance,
            status: paymentStatusFor(total, paid),
            paymentsCount: b.payments.length,
            lastPaymentAt:
                b.payments.length > 0
                    ? b.payments.reduce(
                        (latest, p) => (new Date(p.paidAt) > new Date(latest) ? p.paidAt : latest),
                        b.payments[0].paidAt,
                    )
                    : null,
        };
    });

    if (statusFilter) {
        itemsAll = itemsAll.filter((i) => i.status === statusFilter);
    }

    const items = itemsAll;

    // ── KPIs ──────────────────────────────────────────────────────
    const facturado = items.reduce((a, i) => a + i.grandTotal, 0);
    const cobrado = items.reduce((a, i) => a + i.paid, 0);
    const porCobrar = Math.max(0, facturado - cobrado);
    const tasaCobranza = facturado === 0 ? 0 : Math.round((cobrado / facturado) * 100);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ventasMes = items
        .filter((i) => i.acceptedAt && new Date(i.acceptedAt) >= currentMonthStart)
        .reduce((a, i) => a + i.grandTotal, 0);
    const cobradoMes = items
        .filter((i) => i.acceptedAt && new Date(i.acceptedAt) >= currentMonthStart)
        .reduce((a, i) => a + i.paid, 0);

    // ── Serie mensual ─────────────────────────────────────────────
    const monthlyMap = new Map<string, { billed: number; collected: number }>();
    const fmtLabel = new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" });
    const cursor = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1);
    const end = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);
    while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(key, { billed: 0, collected: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const i of items) {
        if (!i.acceptedAt) continue;
        const d = new Date(i.acceptedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap.has(key)) monthlyMap.set(key, { billed: 0, collected: 0 });
        const m = monthlyMap.get(key)!;
        m.billed += i.grandTotal;
    }

    // Pagos por mes (en el período) — computamos con groupBy raw para que agarre la fecha del pago, no la del budget
    const paymentsInRange = await prisma.payment.findMany({
        where: { paidAt: { gte: dateFrom, lte: dateTo } },
        select: { amount: true, paidAt: true, method: true },
    });
    for (const p of paymentsInRange) {
        const d = new Date(p.paidAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap.has(key)) monthlyMap.set(key, { billed: 0, collected: 0 });
        monthlyMap.get(key)!.collected += Number(p.amount);
    }

    const monthlySeries = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => {
            const [y, m] = key.split("-").map(Number);
            const dt = new Date(y, m - 1, 1);
            return {
                month: key,
                label: fmtLabel.format(dt),
                billed: v.billed,
                collected: v.collected,
            };
        });

    // ── Suma por método de pago ───────────────────────────────────
    const byMethodMap: Record<string, number> = {};
    for (const p of paymentsInRange) {
        byMethodMap[p.method] = (byMethodMap[p.method] ?? 0) + Number(p.amount);
    }
    const byMethod = Object.entries(byMethodMap).map(([method, amount]) => ({
        method: method as PaymentMethod,
        amount,
    }));

    // ── Top clientes por monto cobrado ────────────────────────────
    const customerCollected = new Map<string, { name: string; email: string; paid: number; count: number }>();
    for (const i of items) {
        const key = i.customerEmail;
        const prev = customerCollected.get(key);
        if (prev) {
            prev.paid += i.paid;
            prev.count += 1;
        } else {
            customerCollected.set(key, {
                name: i.customerName,
                email: key,
                paid: i.paid,
                count: 1,
            });
        }
    }
    const topCustomers = Array.from(customerCollected.values())
        .filter((c) => c.paid > 0)
        .sort((a, b) => b.paid - a.paid)
        .slice(0, 5);

    return NextResponse.json({
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
        kpis: { facturado, cobrado, porCobrar, tasaCobranza, ventasMes, cobradoMes },
        items,
        monthlySeries,
        byMethod,
        topCustomers,
    });
}
