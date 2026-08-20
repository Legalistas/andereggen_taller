import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import {
  buildLeadContext,
  sendRepairEventNotification,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { autoCreatePurchasesForItems } from "@/lib/purchases/auto-create";
import type {
  InsuranceResponsibility,
  LeadLostReason,
  LeadStatus,
  PartsPurchaser,
} from "../../../../../../generated/prisma/client";

const ALL_STATUSES: LeadStatus[] = [
  "solicitud",
  "control",
  "enviado",
  "refuerzo",
  "pendientes_cobro",
  "ganado",
  "perdido",
];
const LOST_REASONS: LeadLostReason[] = [
  "precio",
  "demora",
  "no_respondio",
  "competencia",
  "otro",
];
const INSURANCE_RESPONSIBILITIES: InsuranceResponsibility[] = [
  "propio",
  "tercero",
  "particular",
];
const PARTS_PURCHASERS: PartsPurchaser[] = ["TALLER", "SEGURO"];

type RouteContext = { params: Promise<{ id: string }> };

const ACTOR_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          country: { select: { id: true, name: true, code: true } },
          state: { select: { id: true, name: true } },
        },
      },
      vehicle: true,
      inspector: { select: ACTOR_SELECT },
      insuranceAgent: { select: ACTOR_SELECT },
      insuranceCompany: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          contactName: true,
        },
      },
      budgets: {
        orderBy: { createdAt: "desc" },
        include: {
          concepts: { orderBy: { order: "asc" } },
          parts: { orderBy: { order: "asc" } },
        },
      },
      repairs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          directCreation: true,
          budgetId: true,
          assignedMechanic: {
            select: { id: true, name: true, email: true, image: true },
          },
          scheduledAt: true,
          enteredAt: true,
          partsReceivedAt: true,
          estimatedDeliveryAt: true,
          archivedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    status,
    notes,
    lostReason,
    lostNotes,
    vehicleId,
    inspectorId,
    insuranceAgentId,
    insuranceCompanyId,
    insuranceResponsibility,
    partsPurchaser,
  } = body as {
    status?: LeadStatus;
    notes?: string | null;
    lostReason?: LeadLostReason | null;
    lostNotes?: string | null;
    vehicleId?: string | null;
    inspectorId?: string | null;
    insuranceAgentId?: string | null;
    insuranceCompanyId?: string | null;
    insuranceResponsibility?: InsuranceResponsibility | null;
    // spec v3 · Compras v3: quién financia la compra de repuestos.
    // Obligatorio al pasar el lead a Ganado si aún no hay Repair.
    partsPurchaser?: PartsPurchaser | null;
  };

  if (status && !ALL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (lostReason && !LOST_REASONS.includes(lostReason)) {
    return NextResponse.json({ error: "Invalid lostReason" }, { status: 400 });
  }
  if (
    insuranceResponsibility &&
    !INSURANCE_RESPONSIBILITIES.includes(insuranceResponsibility)
  ) {
    return NextResponse.json(
      { error: "Invalid insuranceResponsibility" },
      { status: 400 },
    );
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // spec 1.2 v2 · "Seguro Responsable" es obligatorio antes de pasar a Ganado.
  // Miramos el valor efectivo tras el patch: si viene en el body usamos ese,
  // si no, el que ya tiene el lead.
  const effectiveResponsibility =
    insuranceResponsibility !== undefined
      ? insuranceResponsibility
      : existing.insuranceResponsibility;
  if (status === "ganado" && !effectiveResponsibility) {
    return NextResponse.json(
      {
        error:
          "Debe seleccionar Seguro Responsable (Propio / Tercero / Particular) antes de pasar el lead a Ganado.",
      },
      { status: 400 },
    );
  }

  // spec v3 · partsPurchaser obligatorio al pasar a Ganado si aún no hay Repair.
  if (partsPurchaser !== undefined && partsPurchaser !== null) {
    if (!PARTS_PURCHASERS.includes(partsPurchaser)) {
      return NextResponse.json(
        { error: "partsPurchaser inválido (TALLER | SEGURO)" },
        { status: 400 },
      );
    }
  }
  if (status === "ganado" && existing.status !== "ganado") {
    const existingRepair = await prisma.repair.findFirst({
      where: { leadId: id },
      select: { id: true },
    });
    if (!existingRepair && !partsPurchaser) {
      return NextResponse.json(
        {
          error:
            "Elegí quién compra los repuestos (Taller / Seguro) antes de pasar el lead a Ganado.",
        },
        { status: 400 },
      );
    }
  }

  // Validar que los actores asignados existan y tengan el rol correcto.
  const checkRole = async (
    userId: string | null | undefined,
    expectedRole: "inspector" | "productor_seguros",
  ): Promise<string | null> => {
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { name: true } } },
    });
    if (!user) return `Usuario ${userId} no encontrado`;
    if (user.role?.name !== expectedRole) {
      return `El usuario seleccionado no tiene rol "${expectedRole}"`;
    }
    return null;
  };

  if (inspectorId !== undefined && inspectorId !== null) {
    const err = await checkRole(inspectorId, "inspector");
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  if (insuranceAgentId !== undefined && insuranceAgentId !== null) {
    const err = await checkRole(insuranceAgentId, "productor_seguros");
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // Validar Compañía de Seguros (spec 8.1)
  if (insuranceCompanyId !== undefined && insuranceCompanyId !== null) {
    const company = await prisma.insuranceCompany.findUnique({
      where: { id: insuranceCompanyId },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Compañía de seguros no encontrada" },
        { status: 400 },
      );
    }
  }

  // Si el lead queda en "ganado" y todavía no tiene una Repair asociada,
  // creamos una automáticamente usando el último budget (si existe) o un
  // snapshot directo del cliente/vehículo del lead (si no hay budget).
  // Idempotente: si ya hay una Repair, no se duplica. Esto cubre tanto la
  // transición nueva (drag a "ganado") como leads que ya estaban en ganado
  // antes de existir este auto-create.
  const finalStatus = status ?? existing.status;
  const willBeGanado = finalStatus === "ganado";
  // spec 1.1 + 3.1 v2 · Imputamos "ganados por mes" al momento de recibir la
  // orden. Marcamos orderReceivedAt en la transición a ganado (solo si no
  // estaba ya seteado, para no pisar backfills o re-transiciones).
  const shouldSetOrderReceivedAt =
    status === "ganado" &&
    existing.status !== "ganado" &&
    !existing.orderReceivedAt;

  const lead = await prisma.$transaction(async (tx) => {
    // Ojo con el `include` de este update: el frontend hace merge shallow
    // (`{...prev, ...body.lead}`) al recibir el PATCH, así que si acá
    // devolvemos `vehicle` o `customer` con un select reducido, pisamos los
    // que ya tenía en memoria y los inputs controlados (chassis, color,
    // country, state, etc.) pasan a undefined → warning de React. Por eso
    // replicamos el mismo shape que el GET.
    const updated = await tx.lead.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(lostReason !== undefined && { lostReason }),
        ...(lostNotes !== undefined && { lostNotes }),
        ...(vehicleId !== undefined && { vehicleId }),
        ...(inspectorId !== undefined && { inspectorId }),
        ...(insuranceAgentId !== undefined && { insuranceAgentId }),
        ...(insuranceCompanyId !== undefined && { insuranceCompanyId }),
        ...(insuranceResponsibility !== undefined && {
          insuranceResponsibility,
        }),
        ...(shouldSetOrderReceivedAt && { orderReceivedAt: new Date() }),
      },
      include: {
        customer: {
          include: {
            country: { select: { id: true, name: true, code: true } },
            state: { select: { id: true, name: true } },
          },
        },
        vehicle: true,
        inspector: { select: ACTOR_SELECT },
        insuranceAgent: { select: ACTOR_SELECT },
        insuranceCompany: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactName: true,
          },
        },
      },
    });

    if (willBeGanado) {
      // ¿Ya existe alguna Repair para este lead?
      const existingRepair = await tx.repair.findFirst({
        where: { leadId: id },
        select: { id: true },
      });

      if (!existingRepair) {
        // Buscar el último budget ORIGINAL del lead para tomar el snapshot.
        // Excluimos ampliaciones (extensionSuffix>0) porque no generan
        // reparación propia: se ligan al repair del padre.
        const lastBudget = await tx.budget.findFirst({
          where: { leadId: id, extensionSuffix: 0 },
          orderBy: { createdAt: "desc" },
        });

        if (lastBudget) {
          // Si hay budget, también lo marcamos como aceptado (si aún no lo está)
          // y creamos la Repair vinculada al budget.
          if (lastBudget.status !== "accepted") {
            await tx.budget.update({
              where: { id: lastBudget.id },
              data: { status: "accepted", acceptedAt: new Date() },
            });
          }
          await tx.repair.create({
            data: {
              // spec 2.1 v2 · El repair arranca en "turno_a_asignar" hasta
              // que el equipo coordine turno con el cliente (setea
              // scheduledAt) — ahí pasa a "turno_asignado".
              status: "turno_a_asignar",
              budgetId: lastBudget.id,
              leadId: id,
              directCreation: false,
              customerId: updated.customerId,
              vehicleId: updated.vehicleId,
              customerName: lastBudget.customerName,
              customerEmail: lastBudget.customerEmail,
              customerPhone: lastBudget.customerPhone,
              vehicleBrand: lastBudget.vehicleBrand,
              vehicleModel: lastBudget.vehicleModel,
              vehicleYear: lastBudget.vehicleYear,
              vehicleDomain: lastBudget.vehicleDomain,
              insuranceCompany: lastBudget.vehicleInsurance,
              partsPurchaser: partsPurchaser ?? null,
              createdById: session?.user?.id ?? null,
            },
          });

          // spec v3 · Auto-crear Purchases por cada BudgetAdminItem del
          // budget. Solo se ejecuta al ganar el lead (dentro del bloque
          // !existingRepair, con lastBudget presente).
          if (partsPurchaser) {
            await autoCreatePurchasesForItems(
              tx,
              lastBudget.id,
              partsPurchaser,
              session?.user?.id ?? null,
            );
          }
        } else if (updated.customer && updated.vehicle) {
          // Lead ganado sin budget — snapshot directo desde customer/vehicle
          await tx.repair.create({
            data: {
              // spec 2.1 v2 · El repair arranca en "turno_a_asignar" hasta
              // que el equipo coordine turno con el cliente (setea
              // scheduledAt) — ahí pasa a "turno_asignado".
              status: "turno_a_asignar",
              leadId: id,
              directCreation: false,
              customerId: updated.customerId,
              vehicleId: updated.vehicleId,
              customerName: updated.customer.name,
              customerEmail: updated.customer.email,
              customerPhone: updated.customer.phone,
              vehicleBrand: updated.vehicle.brand,
              vehicleModel: updated.vehicle.model,
              vehicleYear: updated.vehicle.year,
              vehicleDomain: updated.vehicle.domain,
              insuranceCompany: updated.vehicle.secure || null,
              partsPurchaser: partsPurchaser ?? null,
              createdById: session?.user?.id ?? null,
            },
          });
        }
      }
    }

    return updated;
  });

  // spec 1.3 v2 · Mail de refuerzo comercial cuando el lead entra en
  // "refuerzo". Solo si es una transición efectiva (existing.status !==
  // "refuerzo") — así reasignar dentro de la misma columna no reenvía.
  if (status === "refuerzo" && existing.status !== "refuerzo") {
    buildLeadContext(id)
      .then((ctx) => {
        if (ctx) return sendRepairEventNotification("lead_reinforcement", ctx);
      })
      .catch((e) =>
        console.error("[notif:lead_reinforcement] error en envío:", e),
      );
  }

  return NextResponse.json({ lead });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
