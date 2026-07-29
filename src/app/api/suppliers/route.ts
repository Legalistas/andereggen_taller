/**
 * GET  /api/suppliers?search=&active=1&page=1&pageSize=25  — lista paginada
 * POST /api/suppliers                                       — crea
 *
 * spec Compras v2 · Catálogo único de proveedores (repuestos + fletes
 * juntos). Se usan desde cotizaciones y desde el campo de flete.
 *
 * Paginación: page es 1-based; pageSize se clamppea entre 1..200.
 * Si se manda pageSize=0 se devuelve el listado completo sin paginar
 * (para consumidores como el Select del módulo Compras).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const activeOnly = url.searchParams.get("active") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(url.searchParams.get("pageSize") ?? "25");
  const pageSize =
    rawSize === 0 ? 0 : Math.min(200, Math.max(1, Number.isFinite(rawSize) ? rawSize : 25));

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(activeOnly && { isActive: true }),
  };

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      ...(pageSize > 0 && {
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    }),
  ]);

  return NextResponse.json({
    suppliers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    },
  });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { name, phone, email, address, notes, isActive } = body as Record<
    string,
    unknown
  >;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  // Unique por name — validamos antes para dar mejor error que el constraint.
  const dupe = await prisma.supplier.findUnique({
    where: { name: name.trim() },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: `Ya existe un proveedor llamado "${name.trim()}".` },
      { status: 409 },
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      address:
        typeof address === "string" && address.trim() ? address.trim() : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
