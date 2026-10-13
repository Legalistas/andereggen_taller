/**
 * DELETE /api/caja/card-purchases/[id]
 *
 * spec Tarjetas oct '26 · Borra una compra con tarjeta cargada por error,
 * con sus cuotas. Solo si todavía no se pagó ninguna: con cuotas pagadas la
 * plata ya salió de una caja, y primero hay que borrar ese pago del resumen.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const purchase = await prisma.cardPurchase.findUnique({
    where: { id },
    select: {
      id: true,
      installments: {
        where: { movementId: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!purchase) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  if (purchase.installments.length > 0) {
    return NextResponse.json(
      {
        error:
          "Esta compra tiene cuotas ya pagadas: borrá primero el pago del resumen en la caja",
      },
      { status: 409 },
    );
  }

  await prisma.cardPurchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
