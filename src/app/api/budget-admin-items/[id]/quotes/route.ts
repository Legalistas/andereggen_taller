/**
 * POST /api/budget-admin-items/[id]/quotes
 * Agrega una cotización de proveedor al item.
 * Body: { supplierName: string, price: number, notes?: string }
 *
 * Data interna — no sale en el PDF al cliente.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
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

  const { supplierName, price, notes } = body as Record<string, unknown>;
  if (typeof supplierName !== "string" || supplierName.trim() === "") {
    return NextResponse.json(
      { error: "supplierName es requerido" },
      { status: 400 },
    );
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return NextResponse.json(
      { error: "price debe ser un número >= 0" },
      { status: 400 },
    );
  }

  const quote = await prisma.budgetAdminQuote.create({
    data: {
      itemId: id,
      supplierName: supplierName.trim(),
      price: priceNum,
      notes:
        typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null,
    },
  });

  return NextResponse.json({ quote }, { status: 201 });
}
