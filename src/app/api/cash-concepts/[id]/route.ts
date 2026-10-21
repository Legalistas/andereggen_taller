import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/roles";

const MANAGE_ROLES = [...FINANCE_ROLES, "admin_taller"];
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, MANAGE_ROLES);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const existing = await prisma.cashConcept.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
  }

  const { label, order, isActive } = body as Record<string, unknown>;
  if (label !== undefined && (typeof label !== "string" || !label.trim())) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (typeof label === "string") {
    const dupe = await prisma.cashConcept.findFirst({
      where: {
        id: { not: id },
        parentId: existing.parentId,
        label: { equals: label.trim(), mode: "insensitive" },
      },
    });
    if (dupe) {
      return NextResponse.json({ error: "Ya existe un rubro con ese nombre" }, { status: 409 });
    }
  }

  // Los movimientos ya cargados guardan el texto: renombrar no los toca.
  const concept = await prisma.cashConcept.update({
    where: { id },
    data: {
      ...(typeof label === "string" && { label: label.trim() }),
      ...(order !== undefined && { order: Number(order) }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
  });
  return NextResponse.json({ concept });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, MANAGE_ROLES);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.cashConcept.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
  }
  // Cascade: borrar un rubro borra sus subcategorías. Los movimientos quedan.
  await prisma.cashConcept.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
