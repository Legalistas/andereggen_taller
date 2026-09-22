/**
 * PATCH / DELETE /api/repair-claims/[id] — edita o borra un siniestro de una
 * tarjeta de Producción (spec Producción v4).
 *
 * PATCH body (cualquier subset): {
 *   claimNumber?: string | null
 *   approvedLabor?, approvedParts?: number | "" | null
 *   budgetId?: string | null   — vincular/desvincular el presupuesto
 *   notes?: string | null
 * }
 *
 * Después de cada escritura se recalcula `Repair.approvedInsurance` como la
 * suma de los siniestros: es el número que leen el kanban, la lista, las
 * facturas y los cobros.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  CLAIM_INCLUDE,
  CLAIM_ORDER_BY,
  parseClaimAmount,
  syncApprovedInsurance,
} from "@/lib/repair-claims";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
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

  const existing = await prisma.repairClaim.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Siniestro no encontrado" },
      { status: 404 },
    );
  }

  const { claimNumber, approvedLabor, approvedParts, budgetId, notes } = body;

  let parsedLabor: number | null | undefined;
  let parsedParts: number | null | undefined;
  try {
    parsedLabor = parseClaimAmount(approvedLabor);
    parsedParts = parseClaimAmount(approvedParts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Importe inválido" },
      { status: 400 },
    );
  }

  // Vincular un presupuesto desde acá solo se permite si está libre. Cuando
  // el presupuesto ya tiene su propia tarjeta hay que pasar por
  // POST /api/repairs/[id]/claims, que es el que sabe absorberla.
  if (budgetId !== undefined && budgetId !== null && budgetId !== "") {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId as string },
      select: {
        id: true,
        claim: { select: { id: true } },
        repair: { select: { id: true } },
      },
    });
    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 },
      );
    }
    if (budget.claim && budget.claim.id !== id) {
      return NextResponse.json(
        { error: "Ese presupuesto ya está vinculado a otro siniestro." },
        { status: 409 },
      );
    }
    if (budget.repair && budget.repair.id !== existing.repairId) {
      return NextResponse.json(
        {
          error:
            "Ese presupuesto ya tiene su propia tarjeta: vinculalo con el botón «Vincular presupuesto».",
        },
        { status: 409 },
      );
    }
  }

  const { claims, repair } = await prisma.$transaction(async (tx) => {
    await tx.repairClaim.update({
      where: { id },
      data: {
        ...(claimNumber !== undefined && {
          claimNumber: ((claimNumber as string | null) ?? "").trim() || null,
        }),
        ...(parsedLabor !== undefined && { approvedLabor: parsedLabor }),
        ...(parsedParts !== undefined && { approvedParts: parsedParts }),
        ...(budgetId !== undefined && {
          budgetId: (budgetId as string | null) || null,
        }),
        ...(notes !== undefined && {
          notes: ((notes as string | null) ?? "").trim() || null,
        }),
      },
    });

    await syncApprovedInsurance(tx, existing.repairId);

    return {
      claims: await tx.repairClaim.findMany({
        where: { repairId: existing.repairId },
        include: CLAIM_INCLUDE,
        orderBy: CLAIM_ORDER_BY,
      }),
      repair: await tx.repair.findUnique({
        where: { id: existing.repairId },
        select: { approvedInsurance: true, approvedAt: true },
      }),
    };
  });

  return NextResponse.json({ claims, repair });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.repairClaim.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Siniestro no encontrado" },
      { status: 404 },
    );
  }

  const { claims, repair } = await prisma.$transaction(async (tx) => {
    await tx.repairClaim.delete({ where: { id } });

    // Renumeramos para que no queden huecos (Siniestro 1, 2, 3…).
    const rest = await tx.repairClaim.findMany({
      where: { repairId: existing.repairId },
      orderBy: CLAIM_ORDER_BY,
      select: { id: true },
    });
    for (const [i, c] of rest.entries()) {
      await tx.repairClaim.update({
        where: { id: c.id },
        data: { order: i + 1 },
      });
    }

    await syncApprovedInsurance(tx, existing.repairId);

    return {
      claims: await tx.repairClaim.findMany({
        where: { repairId: existing.repairId },
        include: CLAIM_INCLUDE,
        orderBy: CLAIM_ORDER_BY,
      }),
      repair: await tx.repair.findUnique({
        where: { id: existing.repairId },
        select: { approvedInsurance: true, approvedAt: true },
      }),
    };
  });

  return NextResponse.json({ claims, repair });
}
