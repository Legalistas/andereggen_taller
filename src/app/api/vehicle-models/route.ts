import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const brandId = url.searchParams.get("brandId") ?? undefined;
  const activeOnly = url.searchParams.get("active") === "1";

  const models = await prisma.vehicleModel.findMany({
    where: {
      ...(search && {
        name: { contains: search, mode: "insensitive" },
      }),
      ...(brandId && { brandId }),
      ...(activeOnly && { isActive: true }),
    },
    include: {
      brand: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ models });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { name, brandId, isActive } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }
  if (!brandId || typeof brandId !== "string") {
    return NextResponse.json(
      { error: "brandId es obligatorio" },
      { status: 400 },
    );
  }

  const brand = await prisma.vehicleBrand.findUnique({
    where: { id: brandId },
  });
  if (!brand) {
    return NextResponse.json({ error: "Marca no existe" }, { status: 400 });
  }

  const existing = await prisma.vehicleModel.findUnique({
    where: { brandId_name: { brandId, name: name.trim() } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Ya existe el modelo "${name.trim()}" para ${brand.name}` },
      { status: 409 },
    );
  }

  const model = await prisma.vehicleModel.create({
    data: {
      name: name.trim(),
      brandId,
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
    include: { brand: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ model }, { status: 201 });
}
