import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { InvoiceRecipient } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_RECIPIENTS: InvoiceRecipient[] = ["CLIENTE", "SEGURO", "OTRO"];

/**
 * GET /api/repairs/[id]/invoices — lista las facturas de la reparación.
 * El detalle individual de cada factura vive en /api/repair-invoices/[id].
 */
export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const invoices = await prisma.repairInvoice.findMany({
    where: { repairId: id },
    orderBy: { issuedAt: "asc" },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });
  return NextResponse.json({ invoices });
}

/**
 * POST /api/repairs/[id]/invoices — crea una factura.
 * Body: { number, issuedAt, recipient?, recipientName?, amount, notes? }
 */
export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const existing = await prisma.repair.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { number, issuedAt, recipient, recipientName, amount, notes } =
    body as Record<string, unknown>;

  if (!number || typeof number !== "string" || !number.trim()) {
    return NextResponse.json(
      { error: "Nº de factura es obligatorio" },
      { status: 400 },
    );
  }
  if (!issuedAt || typeof issuedAt !== "string") {
    return NextResponse.json(
      { error: "Fecha de emisión es obligatoria" },
      { status: 400 },
    );
  }
  const issuedDate = new Date(issuedAt);
  if (Number.isNaN(issuedDate.getTime())) {
    return NextResponse.json(
      { error: "Fecha de emisión inválida" },
      { status: 400 },
    );
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return NextResponse.json(
      { error: "Importe inválido" },
      { status: 400 },
    );
  }
  const rec =
    recipient && VALID_RECIPIENTS.includes(recipient as InvoiceRecipient)
      ? (recipient as InvoiceRecipient)
      : "CLIENTE";

  const invoice = await prisma.repairInvoice.create({
    data: {
      repairId: id,
      number: number.trim(),
      issuedAt: issuedDate,
      recipient: rec,
      recipientName:
        typeof recipientName === "string" && recipientName.trim()
          ? recipientName.trim()
          : null,
      amount: parsedAmount,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      createdById: session?.user?.id ?? null,
    },
    include: { payments: true },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
