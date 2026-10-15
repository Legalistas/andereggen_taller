/**
 * GET  /api/caja/cards  — tarjetas con lo que tienen pendiente, por resumen
 * POST /api/caja/cards  — crea una tarjeta
 *
 * spec Tarjetas oct '26 · Las compras con tarjeta no salen de ninguna caja
 * hasta que se paga el resumen. Acá se ve cuánto hay pendiente en cada
 * tarjeta, en qué resumen (mes) cae y cuándo vence.
 */

import { NextResponse } from "next/server";
import { FINANCE_ROLES, verifyAuth } from "@/lib/auth-utils";
import { leerDia } from "@/lib/cuotas";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;

  const todas = new URL(request.url).searchParams.get("all") === "1";
  const [cards, pendientes] = await Promise.all([
    prisma.creditCard.findMany({
      where: todas ? {} : { archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cardInstallment.groupBy({
      by: ["creditCardId", "period"],
      where: { movementId: null },
      _sum: { amount: true },
      _min: { dueDate: true },
      _count: true,
      orderBy: { period: "asc" },
    }),
  ]);

  return NextResponse.json({
    cards: cards.map((card) => {
      const statements = pendientes
        .filter((p) => p.creditCardId === card.id)
        .map((p) => ({
          period: p.period,
          dueDate: p._min.dueDate?.toISOString() ?? null,
          amount: Number(p._sum.amount ?? 0),
          count: p._count,
        }));
      return {
        id: card.id,
        name: card.name,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        archived: card.archivedAt !== null,
        pendingAmount: statements.reduce((s, r) => s + r.amount, 0),
        pendingCount: statements.reduce((s, r) => s + r.count, 0),
        statements,
      };
    }),
  });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }
  const closingDay = leerDia(body?.closingDay);
  const dueDay = leerDia(body?.dueDay);
  if (closingDay === undefined || dueDay === undefined) {
    return NextResponse.json(
      { error: "El día de cierre y el de vencimiento van de 1 a 31" },
      { status: 400 },
    );
  }

  const card = await prisma.creditCard.create({
    data: { name, closingDay, dueDay },
  });
  return NextResponse.json({ card }, { status: 201 });
}
