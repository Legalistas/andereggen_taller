import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const role = url.searchParams.get("role") ?? "all";

  const users = await prisma.user.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(role !== "all" && { role: { name: role } }),
    },
    include: {
      role: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  // No devolvemos password ni accounts
  const safe = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    image: u.image,
    isActive: u.isActive,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  return NextResponse.json({ users: safe });
}

/**
 * POST /api/users
 * Crea un usuario "referencia" (sin Account de better-auth). Útil para roles
 * EXTERNAL como inspector / productor_seguros que no necesitan loguearse.
 * Body: { name, email, roleName? } — roleName busca un Role por su columna `name`.
 */
export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { name, email, phone, roleName } = body as {
    name?: string;
    email?: string;
    phone?: string;
    roleName?: string;
  };

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: "Nombre y email son requeridos" },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: "Email con formato inválido" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const dupe = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (dupe) {
    return NextResponse.json(
      { error: `Ya existe un usuario con el email ${normalizedEmail}.` },
      { status: 409 },
    );
  }

  let roleId: string | undefined;
  if (roleName) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return NextResponse.json(
        { error: `Rol "${roleName}" no existe` },
        { status: 400 },
      );
    }
    roleId = role.id;
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      roleId,
      isActive: true,
    },
    include: { role: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ user }, { status: 201 });
}
