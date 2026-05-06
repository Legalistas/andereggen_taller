import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import {
  buildRepairContext,
  sendRepairEventNotification,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Estados desde los que el sistema puede auto-avanzar a "chapa" cuando se
 * carga la fecha de ingreso por primera vez. Solo turno_asignado: si la card
 * ya está más adelante en el flujo, no la pisamos.
 */
const AUTO_ADVANCE_FROM = new Set(["turno_asignado"]);

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
    internalNumber,
  } = body as Record<string, unknown>;

  // Si viene un internalNumber distinto al actual, validar que sea entero
  // positivo y que no choque con otra Repair (uniqueness manual antes del
  // update para devolver mejor error que el constraint de Postgres).
  let parsedInternalNumber: number | null | undefined;
  if (internalNumber !== undefined) {
    if (internalNumber === null || internalNumber === "") {
      parsedInternalNumber = null;
    } else {
      const n = Number(internalNumber);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json(
          { error: "El Nº interno debe ser un entero positivo" },
          { status: 400 },
        );
      }
      if (n !== existing.internalNumber) {
        const dupe = await prisma.repair.findUnique({
          where: { internalNumber: n },
          select: { id: true },
        });
        if (dupe && dupe.id !== id) {
          return NextResponse.json(
            { error: `Ya existe una reparación con el Nº interno ${n}.` },
            { status: 409 },
          );
        }
      }
      parsedInternalNumber = n;
    }
  }

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

  // Detectar transición: enteredAt pasa de null a un valor + status auto-avanzable.
  // Cuando el taller carga la fecha de ingreso del vehículo, asumimos que ya
  // empezó el trabajo de chapa, así que movemos la card automáticamente.
  const newEnteredAt =
    enteredAt !== undefined
      ? enteredAt
        ? new Date(enteredAt as string)
        : null
      : undefined;
  const willTriggerEntry =
    newEnteredAt !== undefined &&
    newEnteredAt !== null &&
    !existing.enteredAt &&
    AUTO_ADVANCE_FROM.has(existing.status);

  const updated = await prisma.repair.update({
    where: { id },
    data: {
      ...(parsedInternalNumber !== undefined && {
        internalNumber: parsedInternalNumber,
      }),
      ...(assignedMechanicId !== undefined && {
        assignedMechanicId: (assignedMechanicId as string) || null,
      }),
      ...(scheduledAt !== undefined && {
        scheduledAt: scheduledAt ? new Date(scheduledAt as string) : null,
      }),
      ...(enteredAt !== undefined && {
        enteredAt: newEnteredAt,
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
      ...(willTriggerEntry && { status: "chapa" as const }),
    },
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: { select: { id: true, number: true, grandTotal: true } },
    },
  });

  // Si recién cargamos la fecha de ingreso, disparamos el email "vehículo en
  // taller" al cliente (y otros actores definidos en EVENT_RECIPIENTS). Lo
  // hacemos en background para no bloquear la respuesta.
  if (willTriggerEntry) {
    buildRepairContext(updated.id)
      .then((ctx) => {
        if (ctx) return sendRepairEventNotification("vehicle_entered", ctx);
      })
      .catch((e) =>
        console.error("[notif:vehicle_entered] error en envío:", e),
      );
  }

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
