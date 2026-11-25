import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { notifyLeadStatusChange } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/crm/leads/[id]/reminder
 *
 * "Recordar" desde Seguimiento: pasa el lead a "refuerzo", lo que le manda
 * al cliente el Refuerzo 1 (mismo aviso que moverlo en el tablero, C3). La
 * transición es idempotente — si ya está en refuerzo no reenvía.
 *
 * Devuelve: { ok, lead, budgetNumber }
 */
export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      budgets: {
        where: { status: "sent" },
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });
  if (!lead)
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  const budget = lead.budgets[0];
  if (!budget) {
    return NextResponse.json(
      { error: "El lead no tiene presupuesto enviado para recordar." },
      { status: 400 },
    );
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: "refuerzo" },
    select: { id: true, status: true, updatedAt: true },
  });
  notifyLeadStatusChange(id, lead.status, "refuerzo");

  return NextResponse.json({
    ok: true,
    lead: updated,
    budgetNumber: budget.number,
  });
}
