import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { InvoiceRecipient } from "../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_RECIPIENTS: InvoiceRecipient[] = ["CLIENTE", "SEGURO", "OTRO"];

/**
 * PATCH /api/repair-invoices/[id] — edita campos de una factura existente.
 * Acepta subset de: number, issuedAt, recipient, recipientName, amount, notes.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.repairInvoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { number, issuedAt, recipient, recipientName, amount, notes } =
    body as Record<string, unknown>;

  let parsedIssuedAt: Date | undefined;
  if (issuedAt !== undefined) {
    if (!issuedAt || typeof issuedAt !== "string") {
      return NextResponse.json(
        { error: "Fecha de emisión inválida" },
        { status: 400 },
      );
    }
    parsedIssuedAt = new Date(issuedAt);
    if (Number.isNaN(parsedIssuedAt.getTime())) {
      return NextResponse.json(
        { error: "Fecha de emisión inválida" },
        { status: 400 },
      );
    }
  }

  let parsedAmount: number | undefined;
  if (amount !== undefined) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { error: "Importe inválido" },
        { status: 400 },
      );
    }
    parsedAmount = n;
  }

  const updated = await prisma.repairInvoice.update({
    where: { id },
    data: {
      ...(number !== undefined && {
        number: (number as string).trim() || existing.number,
      }),
      ...(parsedIssuedAt !== undefined && { issuedAt: parsedIssuedAt }),
      ...(recipient !== undefined && {
        recipient:
          recipient && VALID_RECIPIENTS.includes(recipient as InvoiceRecipient)
            ? (recipient as InvoiceRecipient)
            : existing.recipient,
      }),
      ...(recipientName !== undefined && {
        recipientName:
          typeof recipientName === "string" && recipientName.trim()
            ? recipientName.trim()
            : null,
      }),
      ...(parsedAmount !== undefined && { amount: parsedAmount }),
      ...(notes !== undefined && {
        notes:
          typeof notes === "string" && notes.trim() ? notes.trim() : null,
      }),
    },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });

  return NextResponse.json({ invoice: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.repairInvoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  // Cascade borra payments asociados (definido en schema).
  await prisma.repairInvoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
