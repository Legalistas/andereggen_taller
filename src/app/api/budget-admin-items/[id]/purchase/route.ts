/**
 * PUT /api/budget-admin-items/[id]/purchase
 *   Upsert de la compra realizada para el item.
 *   Body: { supplierName, amount, purchasedAt?, notes?, receiptUrl? }
 *
 * DELETE /api/budget-admin-items/[id]/purchase
 *   Quita la marca de compra (vuelve a "no comprado todavía").
 *
 * Data interna — no sale en el PDF al cliente.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const item = await prisma.budgetAdminItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  const { supplierName, amount, purchasedAt, notes, receiptUrl } = body as Record<
    string,
    unknown
  >;

  if (typeof supplierName !== "string" || supplierName.trim() === "") {
    return NextResponse.json(
      { error: "supplierName es requerido" },
      { status: 400 },
    );
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return NextResponse.json(
      { error: "amount debe ser un número >= 0" },
      { status: 400 },
    );
  }

  let when = new Date();
  if (typeof purchasedAt === "string" && purchasedAt.trim() !== "") {
    const parsed = new Date(purchasedAt);
    if (!Number.isNaN(parsed.getTime())) when = parsed;
  }

  const data = {
    supplierName: supplierName.trim(),
    amount: amt,
    purchasedAt: when,
    notes:
      typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null,
    receiptUrl:
      typeof receiptUrl === "string" && receiptUrl.trim() !== ""
        ? receiptUrl.trim()
        : null,
  };

  const purchase = await prisma.budgetAdminPurchase.upsert({
    where: { itemId: id },
    create: { itemId: id, ...data },
    update: data,
  });

  return NextResponse.json({ purchase });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  await prisma.budgetAdminPurchase
    .delete({ where: { itemId: id } })
    .catch(() => null); // si no había, no rompemos
  return NextResponse.json({ ok: true });
}
