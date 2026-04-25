import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PartCategory, Prisma } from "../../../../generated/prisma/client";

const CATEGORIES: PartCategory[] = [
  "CARROCERIA",
  "CRISTALERIA",
  "MECANICA",
  "ELECTRICO",
  "PINTURA",
  "FRENOS",
  "SUSPENSION",
  "FILTROS",
  "ILUMINACION",
  "INTERIOR",
  "OTROS",
];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const category = url.searchParams.get("category") as PartCategory | null;
  const lowStock = url.searchParams.get("lowStock") === "1";
  const activeOnly = url.searchParams.get("active") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

  const where: Prisma.PartWhereInput = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { appliesTo: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(category && CATEGORIES.includes(category) && { category }),
    ...(activeOnly && { isActive: true }),
  };

  let parts = await prisma.part.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: limit,
  });

  if (lowStock) {
    // Prisma no soporta where stockQty<=stockMin directamente → filtramos en memoria.
    parts = parts.filter((p) => Number(p.stockQty) <= Number(p.stockMin));
  }

  return NextResponse.json({ parts });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    sku,
    name,
    description,
    brand,
    appliesTo,
    category,
    costPrice,
    salePrice,
    stockQty,
    stockMin,
    isActive,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }
  if (category && !CATEGORIES.includes(category as PartCategory)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (sku && typeof sku === "string") {
    const exists = await prisma.part.findUnique({ where: { sku } });
    if (exists) {
      return NextResponse.json(
        { error: "Ya existe un repuesto con ese SKU" },
        { status: 409 },
      );
    }
  }

  const part = await prisma.part.create({
    data: {
      sku: (sku as string) || null,
      name,
      description: (description as string) ?? null,
      brand: (brand as string) ?? null,
      appliesTo: (appliesTo as string) ?? null,
      category: (category as PartCategory) ?? "OTROS",
      costPrice: Number(costPrice ?? 0),
      salePrice: Number(salePrice ?? 0),
      stockQty: Number(stockQty ?? 0),
      stockMin: Number(stockMin ?? 0),
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
  });

  return NextResponse.json({ part }, { status: 201 });
}
