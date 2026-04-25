import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  BudgetStatus,
  LeadLostReason,
} from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

const LOST_REASONS: LeadLostReason[] = [
  "precio",
  "demora",
  "no_respondio",
  "competencia",
  "otro",
];

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status, lostReason, lostNotes } = body as {
    status?: BudgetStatus;
    lostReason?: LeadLostReason;
    lostNotes?: string | null;
  };

  if (!status)
    return NextResponse.json({ error: "status required" }, { status: 400 });

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  const allowed = ALLOWED_TRANSITIONS[existing.status];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Transition ${existing.status} → ${status} not allowed` },
      { status: 400 },
    );
  }

  if (
    status === "rejected" &&
    lostReason &&
    !LOST_REASONS.includes(lostReason)
  ) {
    return NextResponse.json({ error: "Invalid lostReason" }, { status: 400 });
  }

  const now = new Date();
  const stockWarnings: string[] = [];

  const budget = await prisma.$transaction(async (tx) => {
    const updated = await tx.budget.update({
      where: { id },
      data: {
        status,
        ...(status === "sent" && { sentAt: now }),
        ...(status === "accepted" && { acceptedAt: now }),
        ...(status === "rejected" && { rejectedAt: now }),
      },
    });

    // Sincronizar estado del lead con la transición del presupuesto
    if (status === "sent") {
      await tx.lead.update({
        where: { id: updated.leadId },
        data: { status: "enviado" },
      });
    } else if (status === "accepted") {
      await tx.lead.update({
        where: { id: updated.leadId },
        data: { status: "ganado" },
      });

      // Auto-descuento de stock: por cada BudgetPart con partId, generamos un
      // movimiento OUT y decrementamos Part.stockQty. Partes libres (sin partId)
      // se ignoran. Permitimos stock negativo (warning) para no bloquear ventas.
      const linkedParts = await tx.budgetPart.findMany({
        where: { budgetId: id, partId: { not: null } },
        include: { part: true },
      });

      for (const bp of linkedParts) {
        if (!bp.part) continue;
        const qty = Number(bp.quantity);
        const newStock = Number(bp.part.stockQty) - qty;

        await tx.partMovement.create({
          data: {
            partId: bp.part.id,
            type: "OUT",
            qty,
            reason: `Consumido en presupuesto #${updated.number}`,
            budgetId: updated.id,
            createdById: session?.user?.id ?? null,
          },
        });
        await tx.part.update({
          where: { id: bp.part.id },
          data: { stockQty: newStock },
        });
        if (newStock < 0) {
          stockWarnings.push(
            `${bp.part.name}: stock quedó en ${newStock} (faltaban ${Math.abs(newStock)})`,
          );
        } else if (newStock <= Number(bp.part.stockMin)) {
          stockWarnings.push(`${bp.part.name}: stock bajo (${newStock})`);
        }
      }

      // Auto-crear reparación vinculada al budget (si todavía no existe).
      // Trae el lead para copiar customer/vehicle snapshot.
      const leadForRepair = await tx.lead.findUnique({
        where: { id: updated.leadId },
        select: { customerId: true, vehicleId: true },
      });
      const existingRepair = await tx.repair.findUnique({
        where: { budgetId: updated.id },
      });
      if (!existingRepair && leadForRepair) {
        await tx.repair.create({
          data: {
            status: "turno_asignado",
            budgetId: updated.id,
            leadId: updated.leadId,
            directCreation: false,
            customerId: leadForRepair.customerId,
            vehicleId: leadForRepair.vehicleId,
            customerName: updated.customerName,
            customerEmail: updated.customerEmail,
            customerPhone: updated.customerPhone,
            vehicleBrand: updated.vehicleBrand,
            vehicleModel: updated.vehicleModel,
            vehicleYear: updated.vehicleYear,
            vehicleDomain: updated.vehicleDomain,
            createdById: session?.user?.id ?? null,
          },
        });
      }
    } else if (status === "rejected") {
      await tx.lead.update({
        where: { id: updated.leadId },
        data: {
          status: "perdido",
          ...(lostReason && { lostReason }),
          ...(lostNotes !== undefined && { lostNotes }),
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ budget, stockWarnings });
}
