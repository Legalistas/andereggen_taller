import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
 * Crea un usuario en el sistema. Dos modos:
 *   1. Con password   → usa el plugin admin de better-auth (auth.api.createUser)
 *      para crear User + Account hasheada. Útil para roles INTERNAL que
 *      necesitan loguearse (super_admin, admin_taller, contable).
 *   2. Sin password   → crea solo la fila User como "referencia". Útil para
 *      roles EXTERNAL (inspector, productor_seguros) que no se loguean.
 *
 * Body: { name, email, phone?, roleName?, password?, isActive? }
 */
export async function POST(request: Request) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { name, email, phone, roleName, password, isActive } = body as {
    name?: string;
    email?: string;
    phone?: string;
    roleName?: string;
    password?: string;
    isActive?: boolean;
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
  if (password !== undefined && password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
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

  const trimmedName = name.trim();
  const finalIsActive = isActive ?? true;

  // Caso 1: con password → better-auth admin plugin (crea User + Account)
  if (password) {
    try {
      const result = await auth.api.createUser({
        headers: await headers(),
        body: {
          email: normalizedEmail,
          password,
          name: trimmedName,
          // adminRole de better-auth — lo dejamos como "user" estándar; el rol
          // del taller se asigna abajo vía roleId.
          role: "user",
          data: {},
        },
      });

      const createdId = result?.user?.id;
      if (!createdId) {
        return NextResponse.json(
          { error: "No se pudo crear el usuario en better-auth" },
          { status: 500 },
        );
      }

      // Asignar rol custom + phone + isActive (better-auth no maneja estos)
      const user = await prisma.user.update({
        where: { id: createdId },
        data: {
          phone: phone?.trim() || null,
          roleId,
          isActive: finalIsActive,
        },
        include: { role: { select: { id: true, name: true } } },
      });

      return NextResponse.json({ user }, { status: 201 });
    } catch (e) {
      console.error("[users.create] better-auth createUser falló:", e);
      const msg =
        e instanceof Error ? e.message : "Error al crear el usuario";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Caso 2: sin password → solo referencia (usuario externo)
  const user = await prisma.user.create({
    data: {
      name: trimmedName,
      email: normalizedEmail,
      phone: phone?.trim() || null,
      roleId,
      isActive: finalIsActive,
    },
    include: { role: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ user }, { status: 201 });
}
