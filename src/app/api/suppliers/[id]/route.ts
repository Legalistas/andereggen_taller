/**
 * PATCH  /api/suppliers/[id]  — edita
 * DELETE /api/suppliers/[id]  — borra (los quotes/purchases quedan con
 *                                supplierId = null pero conservan
 *                                `supplierName` como snapshot)
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Proveedor no encontrado" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { name, phone, email, address, notes, isActive } = body as Record<
    string,
    unknown
  >;

  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    }
    const trimmed = name.trim();
    if (trimmed !== existing.name) {
      const dupe = await prisma.supplier.findUnique({
        where: { name: trimmed },
        select: { id: true },
      });
      if (dupe && dupe.id !== id) {
        return NextResponse.json(
          { error: `Ya existe un proveedor llamado "${trimmed}".` },
          { status: 409 },
        );
      }
    }
    data.name = trimmed;
  }
  if (phone !== undefined)
    data.phone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
  if (email !== undefined)
    data.email = typeof email === "string" && email.trim() ? email.trim() : null;
  if (address !== undefined)
    data.address =
      typeof address === "string" && address.trim() ? address.trim() : null;
  if (notes !== undefined)
    data.notes = typeof notes === "string" && notes.trim() ? notes.trim() : null;
  if (isActive !== undefined)
    data.isActive = Boolean(isActive);

  const supplier = await prisma.supplier.update({ where: { id }, data });
  return NextResponse.json({ supplier });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Proveedor no encontrado" },
      { status: 404 },
    );
  }

  // Al borrar, las FK opcionales (BudgetAdminQuote.supplierId,
  // Purchase.supplierId, Purchase.freightSupplierId) se setean a null
  // gracias a los `ON DELETE SET NULL` del schema — el `supplierName` de
  // cada registro sigue existiendo como snapshot.
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
