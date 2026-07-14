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

// spec 2.1 v2 · Estados en los que un repair puede ser auto-archivado al
// completarse el cobro total. Solo estados post-entrega: si todavía está en
// chapa/pintura/etc., que el cobro llegue no debería archivar por error.
const AUTO_ARCHIVE_FROM = new Set([
  "pendientes_cobro",
  "experiencia_cliente",
]);

// Tolerancia para comparar Decimals: si sum(payments) alcanza ≥ (total - $1)
// consideramos cobrado. Cubre redondeos y descuentos chicos que suelen dejar
// unos pocos pesos sin cobrar sin querer.
const PAYMENT_TOLERANCE = 1;

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
    select: { id: true, repairId: true },
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

  const { amount, paidAt, method, reference, notes, cashBoxId } = body as Record<
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

  // spec 4.2 v2 · Caja destino del cobro. Nullable (algunos cobros históricos
  // no la tienen). Si viene el id, validamos que exista.
  let resolvedCashBoxId: string | null = null;
  if (typeof cashBoxId === "string" && cashBoxId.trim()) {
    const box = await prisma.cashBox.findUnique({
      where: { id: cashBoxId },
      select: { id: true },
    });
    if (!box) {
      return NextResponse.json(
        { error: "Caja destino no encontrada" },
        { status: 400 },
      );
    }
    resolvedCashBoxId = box.id;
  }

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
      cashBoxId: resolvedCashBoxId,
      createdById: session?.user?.id ?? null,
    },
  });

  // spec 2.1/2.15 v2 · Auto-archivado al completarse el cobro total. Sumamos
  // el importe facturado y el cobrado en TODAS las facturas del repair; si
  // el cobro cubre el facturado (con tolerancia de $1 para redondeos) y el
  // repair está en un estado post-entrega, lo pasamos a "archivado".
  try {
    const repair = await prisma.repair.findUnique({
      where: { id: invoice.repairId },
      select: { id: true, status: true, archivedAt: true },
    });
    if (repair && AUTO_ARCHIVE_FROM.has(repair.status)) {
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
      const fullyPaid =
        totalBilled > 0 && totalPaid + PAYMENT_TOLERANCE >= totalBilled;
      if (fullyPaid) {
        await prisma.repair.update({
          where: { id: repair.id },
          data: {
            status: "archivado",
            archivedAt: repair.archivedAt ?? new Date(),
          },
        });
      }
    }
  } catch (e) {
    // No queremos que un fallo del auto-archivado rompa el registro del
    // cobro. Se logea y se sigue devolviendo el payment creado.
    console.error("[auto-archive] error:", e);
  }

  return NextResponse.json({ payment }, { status: 201 });
}
