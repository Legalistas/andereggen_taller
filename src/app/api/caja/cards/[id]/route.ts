/**
 * GET   /api/caja/cards/[id]  — cuotas de la tarjeta, con su compra
 * PATCH /api/caja/cards/[id]  — renombra o archiva / desarchiva
 *
 * spec Tarjetas oct '26 · El GET es para conciliar contra el resumen de
 * cuenta: todas las cuotas pendientes y las pagadas de los últimos meses,
 * cada una con el rubro, el proveedor y el detalle de su compra.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { periodoDe, sumarMeses } from "@/lib/cuotas";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Meses hacia atrás de cuotas ya pagadas que se muestran. */
const MESES_PAGADOS = 3;

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const card = await prisma.creditCard.findUnique({ where: { id } });
  if (!card) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  const desde = sumarMeses(periodoDe(new Date()), -MESES_PAGADOS);
  const cuotas = await prisma.cardInstallment.findMany({
    where: {
      creditCardId: id,
      OR: [{ movementId: null }, { period: { gte: desde } }],
    },
    orderBy: [{ period: "asc" }, { createdAt: "asc" }],
    include: {
      purchase: true,
      movement: {
        select: { paidAt: true, cashBox: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({
    card: { id: card.id, name: card.name },
    installments: cuotas.map((c) => ({
      id: c.id,
      number: c.number,
      total: c.total,
      period: c.period,
      amount: Number(c.amount),
      paid: c.movementId !== null,
      paidAt: c.movement?.paidAt.toISOString() ?? null,
      paidFrom: c.movement?.cashBox.name ?? null,
      purchase: {
        id: c.purchase.id,
        date: c.purchase.purchasedAt.toISOString(),
        concept: c.purchase.concept,
        supplier: c.purchase.supplier,
        notes: c.purchase.notes,
        reference: c.purchase.reference,
        amount: Number(c.purchase.amount),
      },
    })),
  });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const archived =
    typeof body?.archived === "boolean" ? body.archived : undefined;
  if (name === "") {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  const card = await prisma.creditCard.findUnique({ where: { id } });
  if (!card) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  if (archived === true) {
    const pendientes = await prisma.cardInstallment.count({
      where: { creditCardId: id, movementId: null },
    });
    if (pendientes > 0) {
      return NextResponse.json(
        { error: "Pagá las cuotas pendientes antes de archivar la tarjeta" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.creditCard.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(archived !== undefined && {
        archivedAt: archived ? new Date() : null,
      }),
    },
  });
  return NextResponse.json({ card: updated });
}
