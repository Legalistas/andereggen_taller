import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import {
  arDayTime,
  notificationTimeline,
  notifyRepairEvent,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { CLAIM_INCLUDE, CLAIM_ORDER_BY } from "@/lib/repair-claims";

type RouteContext = { params: Promise<{ id: string }> };

/** Vehículos por bloque de 1 hora de turnos de entrega (requerimientos v1.3, 5.1). */
const DELIVERY_BLOCK_CAPACITY = 3;

/**
 * Estados desde los que el sistema puede auto-avanzar a "chapa" cuando se
 * carga la fecha de ingreso por primera vez. turno_a_asignar + turno_asignado:
 * si la card ya está más adelante en el flujo, no la pisamos.
 */
const AUTO_ADVANCE_FROM = new Set(["turno_a_asignar", "turno_asignado"]);

// Automatizaciones v1.3 · sección 6: cargar "Entregado" ya NO pasa la tarjeta
// a Experiencia del Cliente. El pase es manual (arrastrar la tarjeta), y eso
// manda la encuesta; los casos con conflicto se pasan directo a Archivado.

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
      lead: {
        select: {
          id: true,
          status: true,
          // Perito y productor: destinatarios al enviar un presupuesto o
          // una ampliación desde la ficha (igual que en Cotizaciones).
          inspector: { select: { id: true, name: true, email: true } },
          insuranceAgent: { select: { id: true, name: true, email: true } },
        },
      },
      // Siniestros de la tarjeta: cada uno con su presupuesto y su desglose
      // de mano de obra / repuestos aprobados por el seguro.
      claims: { include: CLAIM_INCLUDE, orderBy: CLAIM_ORDER_BY },
      customer: { select: { id: true, name: true, email: true } },
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          domain: true,
          // Chasis y color no viven en el snapshot del repair: se leen (y se
          // editan) en vivo desde la ficha del vehículo. El color se carga
          // normalmente recién cuando el auto entra al taller, así que tiene
          // que poder completarse desde Producción.
          chassis: true,
          color: true,
        },
      },
      serviceRating: {
        select: { stars: true, respondedAt: true, token: true },
      },
      invoices: {
        orderBy: { issuedAt: "asc" },
        include: {
          payments: {
            orderBy: { paidAt: "asc" },
            include: {
              cashBox: { select: { id: true, key: true, name: true } },
            },
          },
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

  const notificationLogs = await notificationTimeline(repair.leadId, id);
  return NextResponse.json({ repair: { ...repair, notificationLogs } });
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
    deliveryAppointmentAt,
    deliveredAt,
    notes,
    reason,
    internalNumber,
    insuranceCompany,
    approvedFranchise,
    approvedCustomer,
    approvedAt,
    approvedNotes,
    needsTransport,
    isUrgent,
    isPriority,
    urgencyNote,
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

  // spec Producción v4 · `approvedInsurance` ya no se escribe por acá: es la
  // suma de los siniestros (mano de obra + repuestos de cada uno) y la
  // mantiene `syncApprovedInsurance` desde los endpoints de siniestros. Si
  // se aceptara también acá, los dos valores se irían separando.
  let parsedApprovedFranchise: number | null | undefined;
  let parsedApprovedCustomer: number | null | undefined;
  try {
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
  /** Otras tarjetas que ya usan el N° interno que se está guardando. */
  let internalNumberDuplicates: Array<{
    id: string;
    customerName: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleDomain: string;
    status: string;
  }> = [];
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
      // spec Producción v4 · Repetir el N° interno es válido: el cliente que
      // trae el mismo auto por dos siniestros usa el mismo número en las dos
      // tarjetas. Ya no rechazamos el update; devolvemos las otras tarjetas
      // que lo usan para que la ficha avise y el operador confirme que no es
      // un error de tipeo.
      if (n !== existing.internalNumber) {
        internalNumberDuplicates = await prisma.repair.findMany({
          where: { internalNumber: n, id: { not: id } },
          select: {
            id: true,
            customerName: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehicleDomain: true,
            status: true,
          },
          take: 5,
        });
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

  // spec 2.1 v2 · Auto-transición turno_a_asignar → turno_asignado cuando se
  // carga scheduledAt. Un vehículo con turno coordinado ya no es "por
  // asignar". Solo aplica si venía de turno_a_asignar y todavía no tenía
  // scheduledAt: seteos posteriores no cambian de columna.
  const newScheduledAt =
    scheduledAt !== undefined
      ? scheduledAt
        ? new Date(scheduledAt as string)
        : null
      : undefined;
  const willTriggerTurnAssigned =
    newScheduledAt !== undefined &&
    newScheduledAt !== null &&
    !existing.scheduledAt &&
    existing.status === "turno_a_asignar";

  // P7 · Cada vez que se carga o se corrige el Turno de entrega, el cliente
  // recibe el día y la hora desde la que puede retirar.
  const newDeliveryAppointmentAt =
    deliveryAppointmentAt !== undefined
      ? deliveryAppointmentAt
        ? new Date(deliveryAppointmentAt as string)
        : null
      : undefined;
  const willTriggerDeliveryAppointment =
    newDeliveryAppointmentAt != null &&
    newDeliveryAppointmentAt.getTime() !==
      existing.deliveryAppointmentAt?.getTime();

  // 5.1 · Las entregas se dan en bloques de 1 hora, con 3 vehículos por
  // bloque. Argentina es UTC-3 fijo: la hora entera UTC es la hora entera AR.
  if (willTriggerDeliveryAppointment) {
    const blockStart = new Date(newDeliveryAppointmentAt);
    blockStart.setUTCMinutes(0, 0, 0);
    const taken = await prisma.repair.count({
      where: {
        id: { not: id },
        deliveryAppointmentAt: {
          gte: blockStart,
          lt: new Date(blockStart.getTime() + 3_600_000),
        },
      },
    });
    if (taken >= DELIVERY_BLOCK_CAPACITY) {
      const { day, time } = arDayTime(blockStart);
      return NextResponse.json(
        {
          error: `El bloque del ${day} de las ${time} ya tiene ${DELIVERY_BLOCK_CAPACITY} entregas. Elegí otro horario.`,
        },
        { status: 409 },
      );
    }
  }

  // Si el usuario seteó franquicia/particular y no mandó approvedAt
  // explícito, lo dejamos en "hoy" para registrar el momento. (Lo aprobado
  // por el seguro hace lo mismo desde los endpoints de siniestros.)
  const someApprovalProvided =
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
      ...(deliveryAppointmentAt !== undefined && {
        deliveryAppointmentAt: newDeliveryAppointmentAt,
      }),
      ...(deliveredAt !== undefined && {
        deliveredAt: deliveredAt ? new Date(deliveredAt as string) : null,
      }),
      ...(notes !== undefined && { notes: (notes as string | null) || null }),
      ...(reason !== undefined && {
        reason: (reason as string | null) || null,
      }),
      ...(insuranceCompany !== undefined && {
        insuranceCompany: (insuranceCompany as string | null) || null,
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
      ...(needsTransport !== undefined && {
        needsTransport: Boolean(needsTransport),
      }),
      // Urgencia del cliente: dato interno del taller. Nunca se incluye en
      // los mails ni en el contexto de notificaciones.
      ...(isUrgent !== undefined && { isUrgent: Boolean(isUrgent) }),
      ...(isPriority !== undefined && { isPriority: Boolean(isPriority) }),
      ...(urgencyNote !== undefined && {
        urgencyNote: ((urgencyNote as string | null) ?? "").trim() || null,
      }),
      ...(willTriggerTurnAssigned && { status: "turno_asignado" as const }),
      ...(willTriggerEntry && { status: "chapa" as const }),
    },
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: { select: { id: true, number: true, grandTotal: true } },
      invoices: {
        orderBy: { issuedAt: "asc" },
        include: {
          payments: {
            orderBy: { paidAt: "asc" },
            include: {
              cashBox: { select: { id: true, key: true, name: true } },
            },
          },
        },
      },
    },
  });

  // P3 · Se cargó la fecha de ingreso: "vehículo en taller".
  if (willTriggerEntry) notifyRepairEvent("vehicle_entered", id);
  // P1 · La card pasa de "Turno a Asignar" a "Turno Asignado".
  if (willTriggerTurnAssigned) notifyRepairEvent("turn_assigned", id);
  // P7 · Turno de entrega cargado o corregido.
  if (willTriggerDeliveryAppointment) {
    notifyRepairEvent("delivery_appointment", id);
  }

  return NextResponse.json({
    repair: updated,
    // Vacío salvo que el N° interno guardado ya lo use otra tarjeta.
    internalNumberDuplicates,
  });
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
