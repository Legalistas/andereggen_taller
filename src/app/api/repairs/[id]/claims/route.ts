/**
 * POST /api/repairs/[id]/claims — agrega un siniestro a la tarjeta.
 *
 * spec Producción v4 · El mismo vehículo puede estar en el taller por dos
 * siniestros. En vez de abrir una segunda tarjeta (que duplicaba el auto en
 * el kanban y obligaba a repetir el Nº interno), se agrega un siniestro más a
 * la tarjeta existente, con su presupuesto y sus importes aprobados.
 *
 * Body: {
 *   budgetId?: string    — presupuesto de este siniestro
 *   claimNumber?: string — Nº de siniestro de la compañía
 *   approvedLabor?, approvedParts? — importes aprobados por el seguro
 *   absorb?: boolean     — confirma absorber la tarjeta que ese presupuesto
 *                          ya había generado al aceptarse
 * }
 *
 * Si el presupuesto ya tiene su propia tarjeta, responde 409 con `needsAbsorb`
 * y el detalle de lo que se va a mover, para que la ficha pida confirmación
 * antes de fusionar (borra la otra tarjeta).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  CLAIM_INCLUDE,
  CLAIM_ORDER_BY,
  nextClaimOrder,
  parseClaimAmount,
  syncApprovedInsurance,
  type Tx,
} from "@/lib/repair-claims";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const claims = await prisma.repairClaim.findMany({
    where: { repairId: id },
    include: CLAIM_INCLUDE,
    orderBy: CLAIM_ORDER_BY,
  });

  return NextResponse.json({ claims });
}

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const repair = await prisma.repair.findUnique({ where: { id } });
  if (!repair) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  const budgetId = (body.budgetId as string | null) || null;
  const claimNumber = ((body.claimNumber as string | null) ?? "").trim() || null;
  const absorb = Boolean(body.absorb);

  let approvedLabor: number | null | undefined;
  let approvedParts: number | null | undefined;
  try {
    approvedLabor = parseClaimAmount(body.approvedLabor);
    approvedParts = parseClaimAmount(body.approvedParts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Importe inválido" },
      { status: 400 },
    );
  }

  /** Tarjeta que el presupuesto ya había generado, si hay que fusionarla. */
  let sourceRepairId: string | null = null;

  if (budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      select: {
        id: true,
        claim: { select: { id: true, repairId: true } },
        repair: {
          select: {
            id: true,
            internalNumber: true,
            customerName: true,
            vehicleDomain: true,
            _count: { select: { invoices: true, claims: true } },
          },
        },
      },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 },
      );
    }
    if (budget.claim) {
      return NextResponse.json(
        {
          error:
            budget.claim.repairId === id
              ? "Ese presupuesto ya es un siniestro de esta tarjeta."
              : "Ese presupuesto ya está vinculado a otra reparación.",
        },
        { status: 409 },
      );
    }

    // El presupuesto ya generó su propia tarjeta al aceptarse. Para no dejar
    // dos tarjetas del mismo auto hay que absorberla: mover sus siniestros,
    // facturas e importes acá y borrarla. Solo con confirmación explícita.
    if (budget.repair && budget.repair.id !== id) {
      if (!absorb) {
        return NextResponse.json(
          {
            error: "Ese presupuesto ya tiene su propia tarjeta en Producción.",
            needsAbsorb: true,
            otherRepair: {
              id: budget.repair.id,
              internalNumber: budget.repair.internalNumber,
              customerName: budget.repair.customerName,
              vehicleDomain: budget.repair.vehicleDomain,
              invoiceCount: budget.repair._count.invoices,
              claimCount: budget.repair._count.claims,
            },
          },
          { status: 409 },
        );
      }
      sourceRepairId = budget.repair.id;
    }
  }

  try {
    const claims = await prisma.$transaction(async (tx) => {
      if (sourceRepairId) {
        await absorbRepair(tx, sourceRepairId, id);
      } else {
        const order = await nextClaimOrder(tx, id);
        await tx.repairClaim.create({
          data: {
            repairId: id,
            order,
            claimNumber,
            budgetId,
            approvedLabor: approvedLabor ?? null,
            approvedParts: approvedParts ?? null,
          },
        });
      }

      // La card del kanban y las notificaciones siguen leyendo el
      // presupuesto "principal" (Repair.budgetId). Si la tarjeta no tenía
      // ninguno —reparación directa, o una a la que recién le vinculamos el
      // primero— adopta el del primer siniestro que tenga.
      const current = await tx.repair.findUnique({
        where: { id },
        select: { budgetId: true },
      });
      if (!current?.budgetId) {
        const firstWithBudget = await tx.repairClaim.findFirst({
          where: { repairId: id, budgetId: { not: null } },
          orderBy: CLAIM_ORDER_BY,
          select: { budgetId: true },
        });
        if (firstWithBudget?.budgetId) {
          await tx.repair.update({
            where: { id },
            data: { budgetId: firstWithBudget.budgetId },
          });
        }
      }

      await syncApprovedInsurance(tx, id);

      return tx.repairClaim.findMany({
        where: { repairId: id },
        include: CLAIM_INCLUDE,
        orderBy: CLAIM_ORDER_BY,
      });
    });

    // La ficha necesita los totales de la tarjeta ya recalculados (y las
    // notas, que el merge puede haber ampliado).
    const updated = await prisma.repair.findUnique({
      where: { id },
      select: {
        budget: {
          select: {
            id: true,
            number: true,
            extensionSuffix: true,
            status: true,
            grandTotal: true,
          },
        },
        approvedInsurance: true,
        approvedFranchise: true,
        approvedCustomer: true,
        approvedAt: true,
        notes: true,
      },
    });

    return NextResponse.json({ claims, repair: updated }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Error al agregar el siniestro",
      },
      { status: 400 },
    );
  }
}

/**
 * Fusiona la tarjeta `sourceId` dentro de `targetId` y la elimina.
 *
 * Se mueve todo lo que representa plata o trabajo hecho —siniestros, facturas
 * con sus cobros, franquicia y particular— porque el objetivo del merge es
 * justamente que una sola tarjeta sume los importes de los dos siniestros.
 * La encuesta de satisfacción se mueve solo si la tarjeta destino no tiene una
 * propia (la relación es 1-1 con la reparación).
 */
async function absorbRepair(tx: Tx, sourceId: string, targetId: string) {
  const source = await tx.repair.findUnique({
    where: { id: sourceId },
    include: { claims: { orderBy: CLAIM_ORDER_BY } },
  });
  const target = await tx.repair.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      notes: true,
      approvedFranchise: true,
      approvedCustomer: true,
      serviceRating: { select: { id: true } },
    },
  });
  if (!source || !target) throw new Error("Reparación no encontrada");

  let order = await nextClaimOrder(tx, targetId);

  if (source.claims.length > 0) {
    for (const claim of source.claims) {
      await tx.repairClaim.update({
        where: { id: claim.id },
        data: { repairId: targetId, order },
      });
      order += 1;
    }
  } else if (source.budgetId) {
    // Tarjeta vieja sin siniestros cargados: su presupuesto pasa a ser el
    // siniestro nuevo, con lo que tuviera aprobado como mano de obra.
    await tx.repairClaim.create({
      data: {
        repairId: targetId,
        order,
        budgetId: source.budgetId,
        approvedLabor: source.approvedInsurance,
      },
    });
  }

  await tx.repairInvoice.updateMany({
    where: { repairId: sourceId },
    data: { repairId: targetId },
  });

  if (!target.serviceRating) {
    await tx.serviceRating.updateMany({
      where: { repairId: sourceId },
      data: { repairId: targetId },
    });
  }

  // Franquicia y particular son de la tarjeta, no del siniestro: se suman.
  const franchise =
    Number(target.approvedFranchise ?? 0) +
    Number(source.approvedFranchise ?? 0);
  const customer =
    Number(target.approvedCustomer ?? 0) + Number(source.approvedCustomer ?? 0);

  // El motivo y las notas de la tarjeta absorbida se anexan para no perder
  // contexto que el taller haya escrito ahí.
  const carried = [source.reason, source.notes].filter(Boolean).join("\n");
  const label = source.internalNumber
    ? `#${source.internalNumber}`
    : "absorbida";
  const mergedNotes = carried
    ? [target.notes, `— De la tarjeta ${label}:`, carried]
        .filter(Boolean)
        .join("\n")
    : target.notes;

  await tx.repair.update({
    where: { id: targetId },
    data: {
      approvedFranchise:
        franchise > 0 ? franchise : (target.approvedFranchise ?? null),
      approvedCustomer:
        customer > 0 ? customer : (target.approvedCustomer ?? null),
      notes: mergedNotes,
    },
  });

  await tx.repair.delete({ where: { id: sourceId } });
}
