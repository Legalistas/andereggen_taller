/**
 * POST /api/purchases/[id]/mark-paid
 *
 * spec Compras v2 · Marca como PAGADO el repuesto y/o el flete de una
 * compra. Genera un CashMovement EGRESO por cada concepto pagado, en la
 * caja seleccionada, y linkea al Purchase por `paidPartsMovementId` /
 * `paidFreightMovementId`.
 *
 * Body:
 *   {
 *     which: "parts" | "freight" | "both",
 *     cashBoxId: string,
 *     method?: "EFECTIVO" | "TRANSFERENCIA" | ...,
 *     paidAt?: ISO,
 *     notes?: string,
 *   }
 *
 * Idempotencia: si la parte ya está pagada, no crea duplicados — devuelve
 * el movimiento existente en el response.
 *
 * Al marcar como pagado, la Purchase pasa automáticamente a ARCHIVADA si
 * quedan cubiertos AMBOS conceptos (repuesto + flete). Si el flete es 0
 * (no aplica), basta con marcar repuestos.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_METHODS = new Set<PaymentMethod>([
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
]);

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { which, cashBoxId, method, paidAt, notes } = body as Record<
    string,
    unknown
  >;

  if (which !== "parts" && which !== "freight" && which !== "both") {
    return NextResponse.json(
      { error: "which debe ser 'parts', 'freight' o 'both'" },
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
    },
  });
  if (!purchase) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 },
    );
  }

  const notesText =
    typeof notes === "string" && notes.trim() ? notes.trim() : null;

  const result = await prisma.$transaction(async (tx) => {
    const patch: Record<string, unknown> = {};

    // ── Repuesto ──
    const wantsParts = which === "parts" || which === "both";
    if (wantsParts && !purchase.paidPartsMovementId) {
      const amt = Number(purchase.amount);
      if (amt > 0) {
        const partsMovement = await tx.cashMovement.create({
          data: {
            cashBoxId,
            type: "EGRESO",
            amount: amt,
            method: m,
            concept: `Repuesto · Compra ${purchase.number} · ${
              purchase.supplierName ?? purchase.supplier?.name ?? "—"
            } · ${purchase.item.description}`.slice(0, 500),
            notes: notesText,
            paidAt: when,
            createdById: session?.user?.id ?? null,
          },
        });
        patch.paidPartsAt = when;
        patch.paidPartsMovementId = partsMovement.id;
      }
    }

    // ── Flete ──
    const wantsFreight = which === "freight" || which === "both";
    if (wantsFreight && !purchase.paidFreightMovementId) {
      const amt = Number(purchase.freightAmount);
      if (amt > 0) {
        const freightMovement = await tx.cashMovement.create({
          data: {
            cashBoxId,
            type: "EGRESO",
            amount: amt,
            method: m,
            concept: `Flete · Compra ${purchase.number} · ${
              purchase.freightSupplierName ?? purchase.freightSupplier?.name ?? "—"
            } · ${purchase.item.description}`.slice(0, 500),
            notes: notesText,
            paidAt: when,
            createdById: session?.user?.id ?? null,
          },
        });
        patch.paidFreightAt = when;
        patch.paidFreightMovementId = freightMovement.id;
      }
    }

    // ── Auto-transición a ARCHIVADA cuando todo lo debido está pagado ──
    const partsCovered =
      Number(purchase.amount) === 0 ||
      purchase.paidPartsMovementId !== null ||
      patch.paidPartsMovementId !== undefined;
    const freightCovered =
      Number(purchase.freightAmount) === 0 ||
      purchase.paidFreightMovementId !== null ||
      patch.paidFreightMovementId !== undefined;
    if (partsCovered && freightCovered) {
      patch.status = "ARCHIVADA";
      patch.archivedAt = when;
    }

    if (Object.keys(patch).length === 0) {
      return purchase;
    }
    return tx.purchase.update({
      where: { id },
      data: patch,
      include: {
        paidPartsMovement: true,
        paidFreightMovement: true,
      },
    });
  });

  return NextResponse.json({ purchase: result });
}
