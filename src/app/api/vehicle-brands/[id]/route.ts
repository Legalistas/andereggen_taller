import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const brand = await prisma.vehicleBrand.findUnique({
    where: { id },
    include: { models: { orderBy: { name: "asc" } } },
  });
  if (!brand)
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.vehicleBrand.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  const { name, isActive } = body as Record<string, unknown>;

  if (name && typeof name === "string" && name.trim() !== existing.name) {
    const dupe = await prisma.vehicleBrand.findUnique({
      where: { name: name.trim() },
    });
    if (dupe) {
      return NextResponse.json(
        { error: "Ya existe otra marca con ese nombre" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.vehicleBrand.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
  });

  return NextResponse.json({ brand: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.vehicleBrand.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  // El onDelete: Cascade de VehicleModel borra también los modelos.
  await prisma.vehicleBrand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
