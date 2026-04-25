import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { nextBudgetNumber } from "@/lib/budget-service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Clona un presupuesto como `draft` nuevo dentro del mismo Lead.
 * Copia conceptos + partes (incluido el partId si estaba linkeado).
 * El snapshot de cliente/vehículo se toma del budget original.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const session = await getServerSession();

  const original = await prisma.budget.findUnique({
    where: { id },
    include: {
      concepts: { orderBy: { order: "asc" } },
      parts: { orderBy: { order: "asc" } },
    },
  });
  if (!original) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  const duplicated = await prisma.$transaction(async (tx) => {
    const number = await nextBudgetNumber(tx);
    return tx.budget.create({
      data: {
        leadId: original.leadId,
        number,
        status: "draft",
        createdById: session?.user?.id ?? null,

        // Snapshot — se copia tal cual del original
        customerName: original.customerName,
        customerEmail: original.customerEmail,
        customerPhone: original.customerPhone,
        customerDni: original.customerDni,
        customerAddress: original.customerAddress,
        vehicleBrand: original.vehicleBrand,
        vehicleModel: original.vehicleModel,
        vehicleYear: original.vehicleYear,
        vehicleDomain: original.vehicleDomain,
        vehicleInsurance: original.vehicleInsurance,

        // Observaciones — heredan del original
        validityDays: original.validityDays,
        deliveryDays: original.deliveryDays,
        paymentCondition: original.paymentCondition,
        observations: original.observations,

        // Totales — se recalculan al editar; copiamos los actuales
        laborSubtotal: original.laborSubtotal,
        ivaRate: original.ivaRate,
        ivaAmount: original.ivaAmount,
        laborTotal: original.laborTotal,
        partsSubtotal: original.partsSubtotal,
        grandTotal: original.grandTotal,

        concepts: {
          create: original.concepts.map((c) => ({
            type: c.type,
            category: c.category,
            order: c.order,
            subdetails: c.subdetails,
            additionalDetail: c.additionalDetail,
            units: c.units,
            unitValue: c.unitValue,
            fixedAmount: c.fixedAmount,
            fixedDescription: c.fixedDescription,
            subtotal: c.subtotal,
          })),
        },
        parts: {
          create: original.parts.map((p) => ({
            order: p.order,
            partId: p.partId,
            quantity: p.quantity,
            description: p.description,
            unitPrice: p.unitPrice,
            subtotal: p.subtotal,
          })),
        },
      },
      include: { concepts: true, parts: true },
    });
  });

  return NextResponse.json({ budget: duplicated }, { status: 201 });
}
