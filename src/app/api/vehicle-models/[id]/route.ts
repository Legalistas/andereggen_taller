import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const model = await prisma.vehicleModel.findUnique({
    where: { id },
    include: { brand: { select: { id: true, name: true } } },
  });
  if (!model)
    return NextResponse.json(
      { error: "Modelo no encontrado" },
      { status: 404 },
    );
  return NextResponse.json({ model });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, [
    "super_admin",
    "admin_taller",
    "contable",
  ]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.vehicleModel.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json(
      { error: "Modelo no encontrado" },
      { status: 404 },
    );

  const { name, brandId, isActive } = body as Record<string, unknown>;

  // Validar unicidad si cambia nombre y/o marca
  const targetBrandId =
    (brandId as string) !== undefined ? (brandId as string) : existing.brandId;
  const targetName = typeof name === "string" ? name.trim() : existing.name;

  if (targetName !== existing.name || targetBrandId !== existing.brandId) {
    const dupe = await prisma.vehicleModel.findUnique({
      where: { brandId_name: { brandId: targetBrandId, name: targetName } },
    });
    if (dupe && dupe.id !== id) {
      return NextResponse.json(
        { error: "Ya existe otro modelo con ese nombre para esa marca" },
        { status: 409 },
      );
    }
  }

  if (brandId && typeof brandId === "string") {
    const brand = await prisma.vehicleBrand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      return NextResponse.json({ error: "Marca no existe" }, { status: 400 });
    }
  }

  const updated = await prisma.vehicleModel.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(brandId !== undefined && { brandId: brandId as string }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
    include: { brand: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ model: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, [
    "super_admin",
    "admin_taller",
    "contable",
  ]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.vehicleModel.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json(
      { error: "Modelo no encontrado" },
      { status: 404 },
    );

  await prisma.vehicleModel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
