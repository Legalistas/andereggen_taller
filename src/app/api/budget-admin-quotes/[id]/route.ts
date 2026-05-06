/**
 * PATCH /api/budget-admin-quotes/[id]
 *   Edita supplierName / price / notes de una cotización.
 *
 * DELETE /api/budget-admin-quotes/[id]
 *   Borra la cotización.
 *
 * Data interna — no sale en el PDF al cliente.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.budgetAdminQuote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Cotización no encontrada" },
      { status: 404 },
    );
  }

  const { supplierName, price, notes } = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (supplierName !== undefined) {
    if (typeof supplierName !== "string" || supplierName.trim() === "") {
      return NextResponse.json(
        { error: "supplierName no puede estar vacío" },
        { status: 400 },
      );
    }
    data.supplierName = supplierName.trim();
  }
  if (price !== undefined) {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { error: "price debe ser un número >= 0" },
        { status: 400 },
      );
    }
    data.price = n;
  }
  if (notes !== undefined) {
    data.notes =
      typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null;
  }

  const updated = await prisma.budgetAdminQuote.update({
    where: { id },
    data,
  });
  return NextResponse.json({ quote: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.budgetAdminQuote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Cotización no encontrada" },
      { status: 404 },
    );
  }

  await prisma.budgetAdminQuote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
