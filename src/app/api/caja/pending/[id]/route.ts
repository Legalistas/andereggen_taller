/**
 * DELETE /api/caja/pending/[id] — cancela o borra un pago preparado.
 * PATCH  /api/caja/pending/[id] — edita campos del pago pendiente.
 *
 * Si ya fue materializado (status=PAGADO), no se puede borrar por acá —
 * hay que borrar el CashMovement resultante desde el listado de la caja.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const row = await prisma.pendingCashPayment.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (row.status === "PAGADO") {
    return NextResponse.json(
      {
        error:
          "Este pago ya fue materializado. Borralo desde el listado de movimientos de la caja.",
      },
      { status: 400 },
    );
  }
  await prisma.pendingCashPayment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { amount, concept, reference, notes, dueDate } = body as Record<
    string,
    unknown
  >;

  const data: Record<string, unknown> = {};
  if (amount !== undefined) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
    }
    data.amount = n;
  }
  if (typeof concept === "string") data.concept = concept.trim();
  if (reference !== undefined)
    data.reference =
      typeof reference === "string" && reference.trim()
        ? reference.trim()
        : null;
  if (notes !== undefined)
    data.notes =
      typeof notes === "string" && notes.trim() ? notes.trim() : null;
  if (dueDate !== undefined)
    data.dueDate =
      typeof dueDate === "string" && dueDate ? new Date(dueDate) : null;

  const row = await prisma.pendingCashPayment.update({
    where: { id },
    data,
  });
  return NextResponse.json({ row });
}
