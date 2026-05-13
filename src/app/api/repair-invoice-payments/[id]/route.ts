import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
];

/**
 * PATCH /api/repair-invoice-payments/[id] — edita un cobro existente.
 * Acepta subset de: amount, paidAt, method, reference, notes.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.repairInvoicePayment.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { amount, paidAt, method, reference, notes } = body as Record<
    string,
    unknown
  >;

  let parsedAmount: number | undefined;
  if (amount !== undefined) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
    }
    parsedAmount = n;
  }

  let parsedPaidAt: Date | undefined;
  if (paidAt !== undefined) {
    if (!paidAt || typeof paidAt !== "string") {
      return NextResponse.json(
        { error: "Fecha de pago inválida" },
        { status: 400 },
      );
    }
    parsedPaidAt = new Date(paidAt);
    if (Number.isNaN(parsedPaidAt.getTime())) {
      return NextResponse.json(
        { error: "Fecha de pago inválida" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.repairInvoicePayment.update({
    where: { id },
    data: {
      ...(parsedAmount !== undefined && { amount: parsedAmount }),
      ...(parsedPaidAt !== undefined && { paidAt: parsedPaidAt }),
      ...(method !== undefined && {
        method:
          method && VALID_METHODS.includes(method as PaymentMethod)
            ? (method as PaymentMethod)
            : existing.method,
      }),
      ...(reference !== undefined && {
        reference:
          typeof reference === "string" && reference.trim()
            ? reference.trim()
            : null,
      }),
      ...(notes !== undefined && {
        notes:
          typeof notes === "string" && notes.trim() ? notes.trim() : null,
      }),
    },
  });

  return NextResponse.json({ payment: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.repairInvoicePayment.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  await prisma.repairInvoicePayment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
