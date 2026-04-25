import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          domain: true,
          secure: true,
          thirdPartySecure: true,
        },
      },
      country: { select: { id: true, name: true } },
      state: { select: { id: true, name: true } },
    },
  });

  if (!customer) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ customer });
}

/**
 * PATCH /api/customers/[id]
 * Acepta cualquier subset de: name, email, phone, dni, dniType, city, cp,
 * address, countryId, stateId. Valida email único si cambia.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  const {
    name,
    email,
    phone,
    dni,
    dniType,
    city,
    cp,
    address,
    countryId,
    stateId,
  } = body as Record<string, unknown>;

  // Email único si cambia
  if (email && typeof email === "string" && email !== existing.email) {
    const dupe = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (dupe) {
      return NextResponse.json(
        { error: "Ya existe otro cliente con ese email" },
        { status: 409 },
      );
    }
  }

  // Validar country/state si cambian
  if (countryId && typeof countryId === "string") {
    const c = await prisma.country.findUnique({ where: { id: countryId } });
    if (!c) {
      return NextResponse.json({ error: "País inválido" }, { status: 400 });
    }
  }
  if (stateId && typeof stateId === "string") {
    const s = await prisma.state.findUnique({ where: { id: stateId } });
    if (!s) {
      return NextResponse.json({ error: "Provincia inválida" }, { status: 400 });
    }
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(email !== undefined && {
        email: (email as string).trim().toLowerCase(),
      }),
      ...(phone !== undefined && { phone: (phone as string).trim() }),
      ...(dni !== undefined && { dni: (dni as string)?.trim() || null }),
      ...(dniType !== undefined && { dniType: (dniType as string) || null }),
      ...(city !== undefined && { city: (city as string).trim() }),
      ...(cp !== undefined && { cp: (cp as string).trim() }),
      ...(address !== undefined && { address: (address as string).trim() }),
      ...(countryId !== undefined && { countryId: countryId as string }),
      ...(stateId !== undefined && { stateId: stateId as string }),
    },
  });

  return NextResponse.json({ customer: updated });
}

/**
 * DELETE /api/customers/[id]
 * Borra el cliente y todo lo dependiente en transacción:
 *   - Leads del cliente (cascade-borra sus Budgets, BudgetConcepts, BudgetParts,
 *     BudgetEmailLogs, Payments; SetNull en PartMovements).
 *   - CustomerVehicles (cascade desde Customer).
 *   - Repairs quedan con customerId / vehicleId en NULL (snapshot histórico).
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { leads: true, vehicles: true, repairs: true } },
    },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Lead → Budget no tiene cascade desde Customer, hay que borrar leads primero.
    // Lead → Budget sí cascada, y Budget → Concept/Part/EmailLog/Payment también.
    await tx.lead.deleteMany({ where: { customerId: id } });
    // CustomerVehicle cascada desde Customer; Repair quedará con customerId/vehicleId en NULL.
    await tx.customer.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true, deleted: existing._count });
}
