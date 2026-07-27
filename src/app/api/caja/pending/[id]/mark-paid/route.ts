/**
 * POST /api/caja/pending/[id]/mark-paid
 *
 * spec v2 · Materializa un pago preparado. Crea un CashMovement EGRESO en
 * la caja correspondiente con los mismos datos (amount, method, concept,
 * reference, notes), marca el pendiente como PAGADO y lo vincula al
 * movimiento creado. Todo atómico.
 *
 * Body opcional: { paidAt?: ISO } — por default = ahora.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const body = await request.json().catch(() => ({}));
  const paidAt =
    body && typeof (body as { paidAt?: unknown }).paidAt === "string"
      ? new Date((body as { paidAt: string }).paidAt)
      : new Date();

  const pending = await prisma.pendingCashPayment.findUnique({
    where: { id },
  });
  if (!pending) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (pending.status !== "PENDIENTE") {
    return NextResponse.json(
      { error: `El pago ya está en estado ${pending.status.toLowerCase()}.` },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const movement = await tx.cashMovement.create({
      data: {
        cashBoxId: pending.cashBoxId,
        type: "EGRESO",
        amount: pending.amount,
        method: pending.method,
        concept: pending.concept,
        reference: pending.reference,
        notes: pending.notes,
        paidAt,
        createdById: session?.user?.id ?? null,
      },
    });
    const updated = await tx.pendingCashPayment.update({
      where: { id },
      data: {
        status: "PAGADO",
        paidAt,
        paidByMovementId: movement.id,
      },
    });
    return { movement, pending: updated };
  });

  return NextResponse.json(result, { status: 201 });
}
