/**
 * DELETE /api/caja/movements/[id]
 *
 * Elimina un movimiento manual de caja (INGRESO, EGRESO o transferencia).
 * Si el movimiento es parte de una transferencia (tiene `transferGroupId`),
 * borramos ambas contrapartes de forma atómica — si no, el balance de las
 * dos cajas involucradas quedaría descuadrado.
 *
 * No aceptamos borrar payments (`RepairInvoicePayment`) por esta ruta:
 * para eso está `/api/caja/payments/[id]` que además avisa si el repair
 * quedó archivado por ese cobro.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const movement = await prisma.cashMovement.findUnique({
    where: { id },
    select: { id: true, transferGroupId: true },
  });
  if (!movement) {
    return NextResponse.json(
      { error: "Movimiento no encontrado" },
      { status: 404 },
    );
  }

  if (movement.transferGroupId) {
    // Borramos las dos contrapartes de la transferencia en una sola query.
    await prisma.cashMovement.deleteMany({
      where: { transferGroupId: movement.transferGroupId },
    });
    return NextResponse.json({ ok: true, deleted: 2, kind: "transfer" });
  }

  await prisma.cashMovement.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: 1, kind: "single" });
}
