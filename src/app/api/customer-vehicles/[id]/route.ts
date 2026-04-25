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
 * Acepta cualquier subset de: brand, model, year, domain, secure,
 * thirdPartySecure. El customerId no se cambia por acá.
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

  const { brand, model, year, domain, secure, thirdPartySecure } = body as Record<
    string,
    unknown
  >;

  const updated = await prisma.customerVehicle.update({
    where: { id },
    data: {
      ...(brand !== undefined && { brand: (brand as string).trim() }),
      ...(model !== undefined && { model: (model as string).trim() }),
      ...(year !== undefined && { year: (year as string).trim() }),
      ...(domain !== undefined && {
        domain: (domain as string).trim().toUpperCase(),
      }),
      ...(secure !== undefined && { secure: (secure as string) ?? "" }),
      ...(thirdPartySecure !== undefined && {
        thirdPartySecure: (thirdPartySecure as string) ?? "",
      }),
    },
  });

  return NextResponse.json({ vehicle: updated });
}
