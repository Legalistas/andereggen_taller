/**
 * GET    /api/purchases/[id]  — detalle (con quotes hermanas para vista OJO)
 * PATCH  /api/purchases/[id]  — actualiza campos + status
 * DELETE /api/purchases/[id]  — borra (solo si no tiene pagos vinculados)
 *
 * spec Compras v2 · La transición de status NO tiene guardias: el brief
 * pide que la compra pueda retroceder (devoluciones). Cualquier estado →
 * cualquier estado es válido.
 *
 * Side effects del PATCH:
 *  - Si `receivedAt` pasa de null a un valor, disparamos el side effect de
 *    "repuestos recibidos": si el Repair aún no tiene `partsReceivedAt`,
 *    lo seteamos con esa fecha. (FASE 6)
 *  - Si viene `chosenQuoteId`, snapshoteamos categoría + supplier de la
 *    quote al momento del cambio (mantiene consistencia histórica).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { PURCHASE_STATUS_KEYS } from "@/lib/purchases/catalog";
import { prisma } from "@/lib/prisma";
import type { PurchaseStatus } from "../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const BUDGET_SELECT = {
  id: true,
  number: true,
  extensionSuffix: true,
  repair: {
    select: {
      id: true,
      internalNumber: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleDomain: true,
      customerName: true,
      partsReceivedAt: true,
    },
  },
} as const;

const PURCHASE_INCLUDE = {
  item: {
    include: {
      budget: { select: BUDGET_SELECT },
      // Todas las quotes del ítem — para la vista OJO (elegida + descartadas).
      quotes: {
        orderBy: { createdAt: "asc" },
        include: { supplier: { select: { id: true, name: true } } },
      },
    },
  },
  // v3 · Budget directo (compras sin item, con presupuesto opcional).
  budget: { select: BUDGET_SELECT },
  chosenQuote: {
    include: { supplier: { select: { id: true, name: true } } },
  },
  supplier: { select: { id: true, name: true } },
  freightSupplier: { select: { id: true, name: true } },
  paidPartsMovement: {
    select: { id: true, paidAt: true, cashBoxId: true, method: true },
  },
  paidFreightMovement: {
    select: { id: true, paidAt: true, cashBoxId: true, method: true },
  },
  // spec v3 · Pagos parciales, ordenados por fecha ASC (cronológicos).
  payments: {
    orderBy: { paidAt: "asc" },
    include: {
      cashMovement: { select: { id: true, cashBoxId: true, method: true } },
      createdBy: { select: { name: true } },
    },
  },
} as const;

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: PURCHASE_INCLUDE,
  });
  if (!purchase) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json({ purchase });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.purchase.findUnique({
    where: { id },
    include: { item: { select: { budget: { select: { repair: { select: { id: true, partsReceivedAt: true } } } } } } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    status,
    chosenQuoteId,
    supplierId,
    supplierName,
    amount,
    freightAmount,
    freightSupplierId,
    freightSupplierName,
    purchasedAt,
    receivedAt,
    archivedAt,
    receiptUrl,
    notes,
  } = body as Record<string, unknown>;

  // Validaciones.
  if (
    status !== undefined &&
    !(typeof status === "string" && PURCHASE_STATUS_KEYS.has(status as PurchaseStatus))
  ) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  const parseAmount = (v: unknown): number | undefined => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error("Importe inválido");
    return n;
  };
  let parsedAmount: number | undefined;
  let parsedFreight: number | undefined;
  try {
    parsedAmount = parseAmount(amount);
    parsedFreight = parseAmount(freightAmount);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Importe inválido" },
      { status: 400 },
    );
  }

  const parseDate = (v: unknown): Date | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const d = new Date(v as string);
    if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida");
    return d;
  };
  let parsedPurchasedAt: Date | null | undefined;
  let parsedReceivedAt: Date | null | undefined;
  let parsedArchivedAt: Date | null | undefined;
  try {
    parsedPurchasedAt = parseDate(purchasedAt);
    parsedReceivedAt = parseDate(receivedAt);
    parsedArchivedAt = parseDate(archivedAt);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fecha inválida" },
      { status: 400 },
    );
  }

  // Snapshot desde quote si viene chosenQuoteId nuevo.
  let quoteSnapshot: {
    chosenQuoteId?: string | null;
    category?: "OFICIAL" | "ALTERNATIVO" | "DESARMADERO";
    supplierId?: string | null;
    supplierName?: string;
    amount?: number;
  } = {};
  if (chosenQuoteId !== undefined) {
    if (chosenQuoteId === null || chosenQuoteId === "") {
      quoteSnapshot = { chosenQuoteId: null };
    } else if (typeof chosenQuoteId === "string") {
      const q = await prisma.budgetAdminQuote.findUnique({
        where: { id: chosenQuoteId },
        select: {
          id: true,
          itemId: true,
          category: true,
          supplierId: true,
          supplierName: true,
          price: true,
          discount: true,
        },
      });
      if (!q || q.itemId !== existing.itemId) {
        return NextResponse.json(
          { error: "Cotización inválida para este ítem" },
          { status: 400 },
        );
      }
      const discount = Number(q.discount ?? 0);
      const net = Number(q.price) * (1 - discount / 100);
      quoteSnapshot = {
        chosenQuoteId: q.id,
        category: q.category,
        supplierId: q.supplierId,
        supplierName: q.supplierName,
        // Si el usuario también mandó `amount`, respeta ese; si no, usa el
        // neto de la cotización como default.
        amount: parsedAmount ?? net,
      };
    }
  }

  // Si vienen supplierId o supplierName manuales, prevalecen sobre el
  // snapshot (permite override).
  const resolvedSupplierId =
    supplierId === undefined
      ? quoteSnapshot.supplierId
      : supplierId === null || supplierId === ""
        ? null
        : (supplierId as string);
  let resolvedSupplierName =
    supplierName === undefined
      ? quoteSnapshot.supplierName
      : supplierName === null || supplierName === ""
        ? null
        : (supplierName as string);
  // Si vino supplierId sin supplierName, hidratamos el snapshot desde la DB.
  if (
    resolvedSupplierId &&
    resolvedSupplierName === undefined
  ) {
    const s = await prisma.supplier.findUnique({
      where: { id: resolvedSupplierId },
      select: { name: true },
    });
    if (s) resolvedSupplierName = s.name;
  }

  const resolvedFreightSupplierId =
    freightSupplierId === undefined
      ? undefined
      : freightSupplierId === null || freightSupplierId === ""
        ? null
        : (freightSupplierId as string);
  let resolvedFreightSupplierName =
    freightSupplierName === undefined
      ? undefined
      : freightSupplierName === null || freightSupplierName === ""
        ? null
        : (freightSupplierName as string);
  if (resolvedFreightSupplierId && resolvedFreightSupplierName === undefined) {
    const s = await prisma.supplier.findUnique({
      where: { id: resolvedFreightSupplierId },
      select: { name: true },
    });
    if (s) resolvedFreightSupplierName = s.name;
  }

  // spec FASE 6 · Al setear receivedAt por primera vez, disparamos el
  // side effect "repuestos recibidos": si el Repair aún no tiene
  // partsReceivedAt, lo seteamos.
  const willTriggerReceived =
    parsedReceivedAt !== undefined &&
    parsedReceivedAt !== null &&
    !existing.receivedAt;

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.update({
      where: { id },
      data: {
        ...(status !== undefined && { status: status as PurchaseStatus }),
        ...(quoteSnapshot.chosenQuoteId !== undefined && {
          chosenQuoteId: quoteSnapshot.chosenQuoteId,
        }),
        ...(quoteSnapshot.category !== undefined && {
          category: quoteSnapshot.category,
        }),
        ...(resolvedSupplierId !== undefined && {
          supplierId: resolvedSupplierId,
        }),
        ...(resolvedSupplierName !== undefined && {
          supplierName: resolvedSupplierName,
        }),
        ...(parsedAmount !== undefined && { amount: parsedAmount }),
        ...(quoteSnapshot.amount !== undefined &&
          parsedAmount === undefined && { amount: quoteSnapshot.amount }),
        ...(parsedFreight !== undefined && { freightAmount: parsedFreight }),
        ...(resolvedFreightSupplierId !== undefined && {
          freightSupplierId: resolvedFreightSupplierId,
        }),
        ...(resolvedFreightSupplierName !== undefined && {
          freightSupplierName: resolvedFreightSupplierName,
        }),
        ...(parsedPurchasedAt !== undefined && {
          purchasedAt: parsedPurchasedAt,
        }),
        ...(parsedReceivedAt !== undefined && {
          receivedAt: parsedReceivedAt,
        }),
        ...(parsedArchivedAt !== undefined && {
          archivedAt: parsedArchivedAt,
        }),
        ...(receiptUrl !== undefined && {
          receiptUrl:
            typeof receiptUrl === "string" && receiptUrl.trim()
              ? receiptUrl.trim()
              : null,
        }),
        ...(notes !== undefined && {
          notes:
            typeof notes === "string" && notes.trim() ? notes.trim() : null,
        }),
      },
      include: PURCHASE_INCLUDE,
    });

    if (willTriggerReceived) {
      const repair = existing.item?.budget?.repair;
      if (repair && !repair.partsReceivedAt) {
        await tx.repair.update({
          where: { id: repair.id },
          data: { partsReceivedAt: parsedReceivedAt! },
        });
      }
    }

    return p;
  });

  return NextResponse.json({ purchase: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Compra no encontrada" },
      { status: 404 },
    );
  }
  if (existing.paidPartsMovementId || existing.paidFreightMovementId) {
    return NextResponse.json(
      {
        error:
          "No se puede borrar una compra con pagos ya registrados. Borrá primero los movimientos desde Caja.",
      },
      { status: 400 },
    );
  }

  await prisma.purchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
