/**
 * POST /api/purchases/[id]/mark-paid
 *
 * spec Compras v3 · Agrega UN pago (parcial o total) a la compra. Crea un
 * PurchasePayment + un CashMovement EGRESO en la caja seleccionada.
 *
 * Body:
 *   {
 *     kind: "PARTS" | "FREIGHT",     // sobre qué concepto se paga
 *     amount: number,                  // monto del pago (>0)
 *     cashBoxId: string,
 *     method?: PaymentMethod,          // default EFECTIVO
 *     paidAt?: ISO,                    // default now
 *     notes?: string,
 *   }
 *
 * Auto-archiva la compra cuando Σ pagos ≥ amount + freightAmount (o cuando
 * amount y freightAmount son 0). Mientras haya saldo, queda en el status
 * actual (o transiciona a PENDIENTE_PAGO si venía sin pagos previos).
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  PaymentMethod,
  PurchasePaymentKind,
} from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_METHODS = new Set<PaymentMethod>([
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
]);

const VALID_KINDS = new Set<PurchasePaymentKind>(["PARTS", "FREIGHT"]);

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { kind, amount, cashBoxId, method, paidAt, notes } = body as Record<
    string,
    unknown
  >;

  if (typeof kind !== "string" || !VALID_KINDS.has(kind as PurchasePaymentKind)) {
    return NextResponse.json(
      { error: "kind debe ser 'PARTS' o 'FREIGHT'" },
      { status: 400 },
    );
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json(
      { error: "amount debe ser un número > 0" },
      { status: 400 },
    );
  }
  if (typeof cashBoxId !== "string" || !cashBoxId) {
    return NextResponse.json(
      { error: "cashBoxId es obligatorio" },
      { status: 400 },
    );
  }
  const m: PaymentMethod =
    method && VALID_METHODS.has(method as PaymentMethod)
      ? (method as PaymentMethod)
      : "EFECTIVO";
  const when = paidAt ? new Date(paidAt as string) : new Date();
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "paidAt inválido" }, { status: 400 });
  }
  const notesText =
    typeof notes === "string" && notes.trim() ? notes.trim() : null;

  const box = await prisma.cashBox.findUnique({ where: { id: cashBoxId } });
  if (!box) {
    return NextResponse.json(
      { error: "Caja no encontrada" },
      { status: 404 },
    );
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      item: { select: { description: true } },
      supplier: { select: { name: true } },
      freightSupplier: { select: { name: true } },
      payments: { select: { kind: true, amount: true } },
    },
  });
  if (!purchase) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 },
    );
  }

  // Sobrepago: rechazamos si el pago supera el saldo del concepto.
  const paidPrevKind = purchase.payments
    .filter((p) => p.kind === kind)
    .reduce((s, p) => s + Number(p.amount), 0);
  const dueKind =
    kind === "PARTS" ? Number(purchase.amount) : Number(purchase.freightAmount);
  const remainingKind = dueKind - paidPrevKind;
  if (amt > remainingKind + 0.01) {
    return NextResponse.json(
      {
        error: `El pago (${amt}) supera el saldo del ${
          kind === "PARTS" ? "repuesto" : "flete"
        } (${remainingKind.toFixed(2)}).`,
      },
      { status: 400 },
    );
  }

  const productLabel =
    purchase.item?.description ?? purchase.productDescription ?? "—";
  const supplierLabel =
    kind === "PARTS"
      ? (purchase.supplierName ?? purchase.supplier?.name ?? "—")
      : (purchase.freightSupplierName ??
        purchase.freightSupplier?.name ??
        "—");
  const concept =
    `${kind === "PARTS" ? "Repuesto" : "Flete"} · Compra ${purchase.number} · ${supplierLabel} · ${productLabel}`.slice(
      0,
      500,
    );

  const result = await prisma.$transaction(async (tx) => {
    const movement = await tx.cashMovement.create({
      data: {
        cashBoxId,
        type: "EGRESO",
        amount: amt,
        method: m,
        concept,
        notes: notesText,
        paidAt: when,
        createdById: session?.user?.id ?? null,
      },
    });

    const payment = await tx.purchasePayment.create({
      data: {
        purchaseId: id,
        kind: kind as PurchasePaymentKind,
        amount: amt,
        cashMovementId: movement.id,
        paidAt: when,
        notes: notesText,
        createdById: session?.user?.id ?? null,
      },
    });

    // Recalcular saldos post-pago y actualizar campos denormalizados +
    // auto-transición.
    const totalPartsPaid = purchase.payments
      .filter((p) => p.kind === "PARTS")
      .reduce((s, p) => s + Number(p.amount), 0) + (kind === "PARTS" ? amt : 0);
    const totalFreightPaid = purchase.payments
      .filter((p) => p.kind === "FREIGHT")
      .reduce((s, p) => s + Number(p.amount), 0) +
      (kind === "FREIGHT" ? amt : 0);

    const partsCovered =
      Number(purchase.amount) === 0 ||
      totalPartsPaid + 0.01 >= Number(purchase.amount);
    const freightCovered =
      Number(purchase.freightAmount) === 0 ||
      totalFreightPaid + 0.01 >= Number(purchase.freightAmount);

    const patch: Record<string, unknown> = {};
    if (kind === "PARTS") patch.paidPartsAt = when;
    if (kind === "FREIGHT") patch.paidFreightAt = when;

    if (partsCovered && freightCovered) {
      patch.status = "ARCHIVADA";
      patch.archivedAt = when;
    } else {
      // Saldo abierto → dejar en PENDIENTE_PAGO para que aparezca en ese tab.
      patch.status = "PENDIENTE_PAGO";
    }

    await tx.purchase.update({ where: { id }, data: patch });

    return { payment, movement };
  });

  return NextResponse.json(result, { status: 201 });
}
