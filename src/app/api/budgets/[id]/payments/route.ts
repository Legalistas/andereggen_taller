import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const METHODS: PaymentMethod[] = [
    "EFECTIVO",
    "TRANSFERENCIA",
    "CHEQUE",
    "TARJETA",
    "MERCADOPAGO",
    "OTRO",
];

export async function GET(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const payments = await prisma.payment.findMany({
        where: { budgetId: id },
        orderBy: { paidAt: "desc" },
        include: {
            createdBy: { select: { id: true, name: true, email: true } },
        },
    });

    const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0);

    return NextResponse.json({ payments, totalPaid });
}

/**
 * POST crea un pago sobre un budget. Solo aplica a budgets con status
 * "accepted" (no tiene sentido cobrar un presupuesto sin ganar).
 * Body: { amount, paidAt?, method?, reference?, notes? }
 */
export async function POST(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;
    const session = await auth();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { amount, paidAt, method, reference, notes } = body as {
        amount?: number | string;
        paidAt?: string;
        method?: PaymentMethod;
        reference?: string;
        notes?: string;
    };

    const budget = await prisma.budget.findUnique({ where: { id } });
    if (!budget) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
    if (budget.status !== "accepted") {
        return NextResponse.json(
            { error: "Solo se pueden cargar pagos en presupuestos aceptados." },
            { status: 400 },
        );
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
        return NextResponse.json({ error: "amount debe ser > 0" }, { status: 400 });
    }
    if (method && !METHODS.includes(method)) {
        return NextResponse.json({ error: "method inválido" }, { status: 400 });
    }

    const payment = await prisma.payment.create({
        data: {
            budgetId: id,
            amount: numericAmount,
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            method: method ?? "EFECTIVO",
            reference: reference || null,
            notes: notes || null,
            createdById: session?.user?.id ?? null,
        },
        include: {
            createdBy: { select: { id: true, name: true, email: true } },
        },
    });

    // Recalcular total pagado para mostrar al cliente el nuevo estado
    const all = await prisma.payment.findMany({
        where: { budgetId: id },
        select: { amount: true },
    });
    const totalPaid = all.reduce((a, p) => a + Number(p.amount), 0);

    return NextResponse.json(
        {
            payment,
            totalPaid,
            budgetTotal: Number(budget.grandTotal),
        },
        { status: 201 },
    );
}
