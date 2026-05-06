import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const vehicle = await prisma.customerVehicle.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!vehicle) {
    return NextResponse.json(
      { error: "Vehículo no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ vehicle });
}

/**
 * PATCH /api/customer-vehicles/[id]
 * Acepta cualquier subset de: brand, model, year, domain, chassis, secure,
 * thirdPartySecure, coverageType, franchise. El customerId no se cambia por acá.
 *
 * coverageType: "todo_riesgo" | "terceros" | null
 * franchise: number — solo aplica si coverageType === "todo_riesgo".
 *   Si coverageType pasa a "terceros", limpiamos la franquicia.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.customerVehicle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Vehículo no encontrado" },
      { status: 404 },
    );
  }

  const {
    brand,
    model,
    year,
    domain,
    chassis,
    color,
    perladoTricapa,
    secure,
    thirdPartySecure,
    coverageType,
    franchise,
  } = body as Record<string, unknown>;

  if (
    coverageType !== undefined &&
    coverageType !== null &&
    coverageType !== "todo_riesgo" &&
    coverageType !== "terceros"
  ) {
    return NextResponse.json(
      { error: "coverageType debe ser 'todo_riesgo', 'terceros' o null" },
      { status: 400 },
    );
  }

  // Resolver coverageType final (el del body o el ya guardado)
  const finalCoverage =
    coverageType !== undefined
      ? (coverageType as string | null)
      : existing.coverageType;

  const data: Record<string, unknown> = {};
  if (brand !== undefined) data.brand = (brand as string).trim();
  if (model !== undefined) data.model = (model as string).trim();
  if (year !== undefined) data.year = (year as string).trim();
  if (domain !== undefined) data.domain = (domain as string).trim().toUpperCase();
  if (chassis !== undefined) {
    const c = (chassis as string | null) ?? "";
    data.chassis = c.trim() === "" ? null : c.trim().toUpperCase();
  }
  if (color !== undefined) {
    const c = (color as string | null) ?? "";
    data.color = c.trim() === "" ? null : c.trim();
  }
  if (perladoTricapa !== undefined) {
    data.perladoTricapa = Boolean(perladoTricapa);
  }
  if (secure !== undefined) data.secure = (secure as string) ?? "";
  if (thirdPartySecure !== undefined) {
    data.thirdPartySecure = (thirdPartySecure as string) ?? "";
  }
  if (coverageType !== undefined) {
    data.coverageType = (coverageType as string | null) || null;
  }
  if (franchise !== undefined) {
    const n = franchise === null || franchise === "" ? null : Number(franchise);
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      return NextResponse.json(
        { error: "franchise debe ser un número >= 0" },
        { status: 400 },
      );
    }
    data.franchise = n;
  }
  // Si la cobertura final es "terceros", la franquicia debe quedar nula.
  if (finalCoverage === "terceros") data.franchise = null;

  const updated = await prisma.customerVehicle.update({ where: { id }, data });

  return NextResponse.json({ vehicle: updated });
}
