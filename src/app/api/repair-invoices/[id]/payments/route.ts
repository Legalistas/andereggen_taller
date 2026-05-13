import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
];

/**
 * POST /api/repair-invoices/[id]/payments — registra un cobro contra la factura.
 * Body: { amount, paidAt, method?, reference?, notes? }
 */
export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const invoice = await prisma.repairInvoice.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { amount, paidAt, method, reference, notes } = body as Record<
    string,
    unknown
  >;

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json(
      { error: "Importe inválido" },
      { status: 400 },
    );
  }
  if (!paidAt || typeof paidAt !== "string") {
    return NextResponse.json(
      { error: "Fecha de pago es obligatoria" },
      { status: 400 },
    );
  }
  const paidDate = new Date(paidAt);
  if (Number.isNaN(paidDate.getTime())) {
    return NextResponse.json(
      { error: "Fecha de pago inválida" },
      { status: 400 },
    );
  }
  const m =
    method && VALID_METHODS.includes(method as PaymentMethod)
      ? (method as PaymentMethod)
      : "EFECTIVO";

  const payment = await prisma.repairInvoicePayment.create({
    data: {
      invoiceId: id,
      amount: parsedAmount,
      paidAt: paidDate,
      method: m,
      reference:
        typeof reference === "string" && reference.trim()
          ? reference.trim()
          : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      createdById: session?.user?.id ?? null,
    },
  });

  return NextResponse.json({ payment }, { status: 201 });
}
