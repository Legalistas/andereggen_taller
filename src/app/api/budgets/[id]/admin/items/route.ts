/**
 * POST /api/budgets/[id]/admin/items
 * Crea un nuevo BudgetAdminItem (repuesto a cotizar) en la pestaña administrativa.
 * Body: { description: string, notes?: string, photos?: string[] }
 * El `order` se asigna como max+1 (al final de la lista).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { description, notes, photos } = body as Record<string, unknown>;
  if (typeof description !== "string" || description.trim() === "") {
    return NextResponse.json(
      { error: "description es requerido" },
      { status: 400 },
    );
  }

  const budget = await prisma.budget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!budget) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  const max = await prisma.budgetAdminItem.aggregate({
    where: { budgetId: id },
    _max: { order: true },
  });

  const photoArr = Array.isArray(photos)
    ? photos.filter((p) => typeof p === "string" && p.trim() !== "").map((p) =>
        (p as string).trim(),
      )
    : [];

  const item = await prisma.budgetAdminItem.create({
    data: {
      budgetId: id,
      order: (max._max.order ?? -1) + 1,
      description: description.trim(),
      notes: typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null,
      photos: photoArr,
    },
    include: {
      quotes: true,
      purchase: true,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
