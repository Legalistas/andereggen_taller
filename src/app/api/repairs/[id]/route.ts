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

/**
 * Estados "el auto está en taller" (antes de retirarse). Cuando se carga
 * `deliveredAt` desde alguno de estos, la reparación pasa automáticamente a
 * `experiencia_cliente` para disparar la encuesta de inmediato. El cobro
 * (pendientes_cobro) llega después porque los seguros pagan a 30/40 días —
 * no queremos esperar todo ese tiempo para mandar la encuesta.
 */
const PRE_DELIVERY_STATUSES = new Set([
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
]);

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
          extensionSuffix: true,
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
      serviceRating: {
        select: { stars: true, respondedAt: true, token: true },
      },
      invoices: {
        orderBy: { issuedAt: "asc" },
        include: {
          payments: { orderBy: { paidAt: "asc" } },
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
    insuranceCompany,
    approvedInsurance,
    approvedFranchise,
    approvedCustomer,
    approvedAt,
    approvedNotes,
  } = body as Record<string, unknown>;

  // Helper: parsea un importe que puede venir como number, string numérico,
  // "" o null. Devuelve null cuando se quiere limpiar el campo.
  const parseAmount = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("Importe inválido");
    }
    return n;
  };

  let parsedApprovedInsurance: number | null | undefined;
  let parsedApprovedFranchise: number | null | undefined;
  let parsedApprovedCustomer: number | null | undefined;
  try {
    parsedApprovedInsurance = parseAmount(approvedInsurance);
    parsedApprovedFranchise = parseAmount(approvedFranchise);
    parsedApprovedCustomer = parseAmount(approvedCustomer);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Importe inválido" },
      { status: 400 },
    );
  }

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

  // Auto-transición a "pendientes_cobro" cuando se setea deliveredAt y el
  // repair está en alguna etapa pre-entrega. Si la card ya está después de
  // entrega (pendientes_cobro / experiencia_cliente / archivado) la dejamos.
  const newDeliveredAt =
    deliveredAt !== undefined
      ? deliveredAt
        ? new Date(deliveredAt as string)
        : null
      : undefined;
  const willTriggerDelivery =
    newDeliveredAt !== undefined &&
    newDeliveredAt !== null &&
    !existing.deliveredAt &&
    PRE_DELIVERY_STATUSES.has(existing.status);

  // Si el usuario seteó approvedInsurance/Franchise/Customer y no mandó
  // approvedAt explícito, lo dejamos en "hoy" para registrar el momento.
  const someApprovalProvided =
    parsedApprovedInsurance !== undefined ||
    parsedApprovedFranchise !== undefined ||
    parsedApprovedCustomer !== undefined;
  const parsedApprovedAt: Date | null | undefined =
    approvedAt !== undefined
      ? approvedAt
        ? new Date(approvedAt as string)
        : null
      : someApprovalProvided && !existing.approvedAt
        ? new Date()
        : undefined;

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
        deliveredAt: newDeliveredAt,
      }),
      ...(notes !== undefined && { notes: (notes as string | null) || null }),
      ...(reason !== undefined && {
        reason: (reason as string | null) || null,
      }),
      ...(insuranceCompany !== undefined && {
        insuranceCompany: (insuranceCompany as string | null) || null,
      }),
      ...(parsedApprovedInsurance !== undefined && {
        approvedInsurance: parsedApprovedInsurance,
      }),
      ...(parsedApprovedFranchise !== undefined && {
        approvedFranchise: parsedApprovedFranchise,
      }),
      ...(parsedApprovedCustomer !== undefined && {
        approvedCustomer: parsedApprovedCustomer,
      }),
      ...(parsedApprovedAt !== undefined && { approvedAt: parsedApprovedAt }),
      ...(approvedNotes !== undefined && {
        approvedNotes: (approvedNotes as string | null) || null,
      }),
      ...(willTriggerEntry && { status: "chapa" as const }),
      ...(willTriggerDelivery && { status: "experiencia_cliente" as const }),
    },
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: { select: { id: true, number: true, grandTotal: true } },
      invoices: {
        orderBy: { issuedAt: "asc" },
        include: { payments: { orderBy: { paidAt: "asc" } } },
      },
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

  // Side-effects de la auto-transición a "experiencia_cliente" al setear
  // deliveredAt: crear el ServiceRating con token (si todavía no existe) y
  // disparar el email de encuesta. Mismo flujo que PATCH /status para
  // este estado — replicado acá porque la auto-transición no pasa por allá.
  if (willTriggerDelivery) {
    try {
      const existingRating = await prisma.serviceRating.findUnique({
        where: { repairId: updated.id },
      });
      if (!existingRating) {
        await prisma.serviceRating.create({
          data: {
            repairId: updated.id,
            token: generateRatingToken(),
          },
        });
      }
    } catch (e) {
      console.error("[rating:create] error:", e);
    }
    buildRepairContext(updated.id)
      .then((ctx) => {
        if (ctx) return sendRepairEventNotification("customer_experience", ctx);
      })
      .catch((e) =>
        console.error("[notif:customer_experience] error en envío:", e),
      );
  }

  return NextResponse.json({ repair: updated });
}

function generateRatingToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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
