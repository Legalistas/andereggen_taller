/**
 * GET   /api/caja/cards/[id]  — resúmenes, cuotas y compras de la tarjeta
 * PATCH /api/caja/cards/[id]  — nombre, día de cierre / vencimiento, archivo
 *
 * spec Tarjetas oct '26 · El GET es para conciliar contra el resumen de
 * cuenta: todas las cuotas pendientes y las pagadas de los últimos meses,
 * cada una con el rubro, el proveedor y el detalle de su compra, más las
 * compras con cuántas cuotas llevan pagadas.
 */

import { NextResponse } from "next/server";
import { FINANCE_ROLES, verifyAuth } from "@/lib/auth-utils";
import { leerDia, sumarMeses } from "@/lib/cuotas";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Meses hacia atrás de cuotas ya pagadas que se muestran. */
const MESES_PAGADOS = 3;

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;
  const { id } = await ctx.params;

  const card = await prisma.creditCard.findUnique({ where: { id } });
  if (!card) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  const hoy = new Date();
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const desde = sumarMeses(actual, -MESES_PAGADOS);
  const cuotas = await prisma.cardInstallment.findMany({
    where: {
      creditCardId: id,
      OR: [{ movementId: null }, { period: { gte: desde } }],
    },
    orderBy: [{ period: "asc" }, { createdAt: "asc" }],
    include: {
      purchase: { include: { createdBy: { select: { name: true } } } },
      movement: {
        select: { paidAt: true, cashBox: { select: { name: true } } },
      },
    },
  });

  // Cuotas pagadas por compra, contando también las que quedaron fuera de la
  // ventana de meses que se muestra.
  const pagadas = await prisma.cardInstallment.groupBy({
    by: ["purchaseId"],
    where: { creditCardId: id, movementId: { not: null } },
    _count: true,
  });
  const pagadasDe = new Map(pagadas.map((p) => [p.purchaseId, p._count]));

  const compras = new Map<string, (typeof cuotas)[number]["purchase"]>();
  const primerResumen = new Map<string, string>();
  for (const c of cuotas) {
    compras.set(c.purchaseId, c.purchase);
    const previo = primerResumen.get(c.purchaseId);
    const primero = sumarMeses(c.period, 1 - c.number);
    if (!previo || primero < previo) primerResumen.set(c.purchaseId, primero);
  }

  return NextResponse.json({
    card: {
      id: card.id,
      name: card.name,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
    },
    installments: cuotas.map((c) => ({
      id: c.id,
      number: c.number,
      total: c.total,
      period: c.period,
      dueDate: c.dueDate.toISOString(),
      amount: Number(c.amount),
      paid: c.movementId !== null,
      paidAt: c.movement?.paidAt.toISOString() ?? null,
      paidFrom: c.movement?.cashBox.name ?? null,
      purchaseId: c.purchaseId,
    })),
    purchases: [...compras.values()]
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())
      .map((p) => {
        const total = cuotas.find((c) => c.purchaseId === p.id)?.total ?? 1;
        return {
          id: p.id,
          date: p.purchasedAt.toISOString(),
          concept: p.concept,
          supplier: p.supplier,
          notes: p.notes,
          reference: p.reference,
          amount: Number(p.amount),
          installments: total,
          paidInstallments: pagadasDe.get(p.id) ?? 0,
          firstPeriod: primerResumen.get(p.id) ?? null,
          createdBy: p.createdBy?.name ?? null,
        };
      }),
  });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
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
  // Los días solo se tocan si vienen en el body. Valen para las compras que
  // se carguen de acá en más: las cuotas ya armadas no se mueven de resumen.
  const closingDay =
    body && "closingDay" in body ? leerDia(body.closingDay) : null;
  const dueDay = body && "dueDay" in body ? leerDia(body.dueDay) : null;
  if (closingDay === undefined || dueDay === undefined) {
    return NextResponse.json(
      { error: "El día de cierre y el de vencimiento van de 1 a 31" },
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
      ...(body && "closingDay" in body && { closingDay }),
      ...(body && "dueDay" in body && { dueDay }),
      ...(archived !== undefined && {
        archivedAt: archived ? new Date() : null,
      }),
    },
  });
  return NextResponse.json({ card: updated });
}
