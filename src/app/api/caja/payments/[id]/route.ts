/**
 * DELETE /api/caja/payments/[id]
 *
 * Elimina un cobro (`RepairInvoicePayment`) desde el módulo Caja. Como el
 * cobro puede haber gatillado el auto-archivado del repair (spec 2.1/2.15
 * v2), si el saldo pendiente actualizado es > 0 y el repair está en
 * `archivado`, lo devolvemos a `pendientes_cobro` para que vuelva a la
 * cola de cobranza y no quede oculto.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const PAYMENT_TOLERANCE = 1;

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const payment = await prisma.repairInvoicePayment.findUnique({
    where: { id },
    select: { id: true, invoice: { select: { repairId: true } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
  }

  await prisma.repairInvoicePayment.delete({ where: { id } });

  // ── Re-evaluar el estado del repair. Si estaba archivado gracias a este
  // cobro, y ahora ya no está totalmente cobrado, lo devolvemos a
  // pendientes_cobro para que vuelva a aparecer en la cola.
  let restored = false;
  if (payment.invoice?.repairId) {
    const repair = await prisma.repair.findUnique({
      where: { id: payment.invoice.repairId },
      select: { id: true, status: true },
    });
    if (repair?.status === "archivado") {
      const invoices = await prisma.repairInvoice.findMany({
        where: { repairId: repair.id },
        select: {
          amount: true,
          payments: { select: { amount: true } },
        },
      });
      const totalBilled = invoices.reduce(
        (a, inv) => a + Number(inv.amount),
        0,
      );
      const totalPaid = invoices.reduce(
        (a, inv) =>
          a + inv.payments.reduce((b, p) => b + Number(p.amount), 0),
        0,
      );
      const stillPaid =
        totalBilled > 0 && totalPaid + PAYMENT_TOLERANCE >= totalBilled;
      if (!stillPaid) {
        await prisma.repair.update({
          where: { id: repair.id },
          data: { status: "pendientes_cobro", archivedAt: null },
        });
        restored = true;
      }
    }
  }

  return NextResponse.json({ ok: true, restored });
}
