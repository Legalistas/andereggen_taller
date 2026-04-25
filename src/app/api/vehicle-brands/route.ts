import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const activeOnly = url.searchParams.get("active") === "1";

  const brands = await prisma.vehicleBrand.findMany({
    where: {
      ...(search && {
        name: { contains: search, mode: "insensitive" },
      }),
      ...(activeOnly && { isActive: true }),
    },
    include: {
      _count: { select: { models: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ brands });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { name, isActive } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  const existing = await prisma.vehicleBrand.findUnique({
    where: { name: name.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una marca con ese nombre" },
      { status: 409 },
    );
  }

  const brand = await prisma.vehicleBrand.create({
    data: {
      name: name.trim(),
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
  });

  return NextResponse.json({ brand }, { status: 201 });
}
