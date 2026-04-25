import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const activeOnly = url.searchParams.get("active") === "1";

  const companies = await prisma.insuranceCompany.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { contactName: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(activeOnly && { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ companies });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { name, phone, email, contactName, notes, isActive } = body as Record<
    string,
    unknown
  >;
  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  const existing = await prisma.insuranceCompany.findUnique({
    where: { name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una aseguradora con ese nombre" },
      { status: 409 },
    );
  }

  const company = await prisma.insuranceCompany.create({
    data: {
      name,
      phone: (phone as string) || null,
      email: (email as string) || null,
      contactName: (contactName as string) || null,
      notes: (notes as string) || null,
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
  });

  return NextResponse.json({ company }, { status: 201 });
}
