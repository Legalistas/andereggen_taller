/**
 * POST /api/caja/cards/[id]/pay
 *
 * spec Tarjetas oct '26 · Paga un resumen de la tarjeta. Crea un
 * CashMovement EGRESO en la caja elegida y deja pagadas las cuotas de ese
 * resumen (apuntando a ese movimiento). Todo atómico.
 *
 * Body: { cashBoxId, paidAt?: ISO, period?: "AAAA-MM", amount?, method? }
 * Sin `period` se paga todo lo que la tarjeta tiene pendiente. `amount`
 * puede ser mayor a la suma de las cuotas (intereses o cargos del resumen),
 * nunca menor; sin `amount` se paga esa suma.
 */

import { NextResponse } from "next/server";
import { FINANCE_ROLES, getServerSession, verifyAuth } from "@/lib/auth-utils";
import { PERIODO } from "@/lib/cuotas";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "../../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
];

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const { cashBoxId, paidAt, period, amount, method } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof cashBoxId !== "string" || !cashBoxId) {
    return NextResponse.json({ error: "Caja es obligatoria" }, { status: 400 });
  }
  if (period !== undefined && period !== null && period !== "") {
    if (typeof period !== "string" || !PERIODO.test(period)) {
      return NextResponse.json(
        { error: "El resumen es inválido" },
        { status: 400 },
      );
    }
  }
  const resumen = typeof period === "string" && period ? period : null;
  const m: PaymentMethod =
    method && VALID_METHODS.includes(method as PaymentMethod)
      ? (method as PaymentMethod)
      : "TRANSFERENCIA";

  const [card, box] = await Promise.all([
    prisma.creditCard.findUnique({ where: { id } }),
    prisma.cashBox.findUnique({ where: { id: cashBoxId } }),
  ]);
  if (!card) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }
  if (!box) {
    return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 });
  }

  const pendientes = await prisma.cardInstallment.findMany({
    where: {
      creditCardId: id,
      movementId: null,
      ...(resumen ? { period: resumen } : {}),
    },
    select: { id: true, amount: true },
  });
  const total = r2(pendientes.reduce((s, c) => s + Number(c.amount), 0));
  if (total <= 0) {
    return NextResponse.json(
      { error: "No hay cuotas pendientes para pagar" },
      { status: 400 },
    );
  }

  const pagado =
    amount === undefined || amount === null || amount === ""
      ? total
      : r2(Number(amount));
  if (!Number.isFinite(pagado) || pagado < total - 0.01) {
    return NextResponse.json(
      {
        error: `El pago tiene que cubrir las cuotas del resumen (${total.toFixed(2)})`,
      },
      { status: 400 },
    );
  }
  const cargos = r2(pagado - total);

  const movement = await prisma.$transaction(async (tx) => {
    const pago = await tx.cashMovement.create({
      data: {
        cashBoxId,
        type: "EGRESO",
        amount: pagado,
        method: m,
        concept: `Resumen tarjeta ${card.name}`,
        notes: `${resumen ? `Resumen ${resumen}` : "Todo lo pendiente"} · ${pendientes.length} cuota${pendientes.length === 1 ? "" : "s"}${cargos > 0 ? ` + ${cargos.toFixed(2)} de cargos` : ""}`,
        paidAt:
          typeof paidAt === "string" && paidAt ? new Date(paidAt) : new Date(),
        createdById: session?.user?.id ?? null,
      },
    });
    await tx.cardInstallment.updateMany({
      where: { id: { in: pendientes.map((c) => c.id) } },
      data: { movementId: pago.id },
    });
    return pago;
  });

  return NextResponse.json({ movement, total, cargos }, { status: 201 });
}
