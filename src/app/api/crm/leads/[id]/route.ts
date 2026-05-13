import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  LeadLostReason,
  LeadStatus,
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
  } = body as {
    status?: LeadStatus;
    notes?: string | null;
    lostReason?: LeadLostReason | null;
    lostNotes?: string | null;
    vehicleId?: string | null;
    inspectorId?: string | null;
    insuranceAgentId?: string | null;
    insuranceCompanyId?: string | null;
  };

  if (status && !ALL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (lostReason && !LOST_REASONS.includes(lostReason)) {
    return NextResponse.json({ error: "Invalid lostReason" }, { status: 400 });
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
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

  const lead = await prisma.$transaction(async (tx) => {
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
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            domain: true,
            // `secure` se usa abajo para snapshotear la compañía aseguradora
            // en el Repair que se crea automáticamente al ganar el lead.
            secure: true,
          },
        },
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
              status: "turno_asignado",
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
              createdById: session?.user?.id ?? null,
            },
          });
        } else if (updated.customer && updated.vehicle) {
          // Lead ganado sin budget — snapshot directo desde customer/vehicle
          await tx.repair.create({
            data: {
              status: "turno_asignado",
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
              createdById: session?.user?.id ?? null,
            },
          });
        }
      }
    }

    return updated;
  });

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
