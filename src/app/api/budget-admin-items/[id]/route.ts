/**
 * PATCH /api/budget-admin-items/[id]
 *   Edita description / notes / photos / order de un item.
 *
 * DELETE /api/budget-admin-items/[id]
 *   Borra el item; cascade borra sus quotes y la purchase asociada.
 *
 * Toda esta data es uso interno del taller — nunca sale en el PDF que ve el cliente.
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

  const existing = await prisma.budgetAdminItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  const { description, notes, photos, order } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (description !== undefined) {
    if (typeof description !== "string" || description.trim() === "") {
      return NextResponse.json(
        { error: "description no puede estar vacío" },
        { status: 400 },
      );
    }
    data.description = description.trim();
  }
  if (notes !== undefined) {
    data.notes =
      typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null;
  }
  if (photos !== undefined) {
    data.photos = Array.isArray(photos)
      ? photos
          .filter((p) => typeof p === "string" && p.trim() !== "")
          .map((p) => (p as string).trim())
      : [];
  }
  if (order !== undefined && Number.isInteger(Number(order))) {
    data.order = Number(order);
  }

  const updated = await prisma.budgetAdminItem.update({
    where: { id },
    data,
    include: { quotes: true, purchase: true },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.budgetAdminItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  await prisma.budgetAdminItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
