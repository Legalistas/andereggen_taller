import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const repair = await prisma.repair.findUnique({
    where: { id },
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: {
        select: {
          id: true,
          number: true,
          status: true,
          grandTotal: true,
        },
      },
      lead: { select: { id: true, status: true } },
      customer: { select: { id: true, name: true, email: true } },
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          domain: true,
        },
      },
    },
  });

  if (!repair) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ repair });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  const {
    assignedMechanicId,
    scheduledAt,
    enteredAt,
    partsReceivedAt,
    estimatedDeliveryAt,
    deliveredAt,
    notes,
    reason,
  } = body as Record<string, unknown>;

  // Validar mecánico si viene un id (debe tener rol "mecanico" o ser INTERNAL)
  if (assignedMechanicId) {
    const mech = await prisma.user.findUnique({
      where: { id: assignedMechanicId as string },
      include: { role: { select: { name: true, type: true } } },
    });
    if (!mech) {
      return NextResponse.json(
        { error: "Usuario asignado no existe" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.repair.update({
    where: { id },
    data: {
      ...(assignedMechanicId !== undefined && {
        assignedMechanicId: (assignedMechanicId as string) || null,
      }),
      ...(scheduledAt !== undefined && {
        scheduledAt: scheduledAt ? new Date(scheduledAt as string) : null,
      }),
      ...(enteredAt !== undefined && {
        enteredAt: enteredAt ? new Date(enteredAt as string) : null,
      }),
      ...(partsReceivedAt !== undefined && {
        partsReceivedAt: partsReceivedAt
          ? new Date(partsReceivedAt as string)
          : null,
      }),
      ...(estimatedDeliveryAt !== undefined && {
        estimatedDeliveryAt: estimatedDeliveryAt
          ? new Date(estimatedDeliveryAt as string)
          : null,
      }),
      ...(deliveredAt !== undefined && {
        deliveredAt: deliveredAt ? new Date(deliveredAt as string) : null,
      }),
      ...(notes !== undefined && { notes: (notes as string | null) || null }),
      ...(reason !== undefined && {
        reason: (reason as string | null) || null,
      }),
    },
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: { select: { id: true, number: true, grandTotal: true } },
    },
  });

  return NextResponse.json({ repair: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  await prisma.repair.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
