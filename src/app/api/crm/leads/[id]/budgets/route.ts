import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import {
  BudgetValidationError,
  createBudgetForLead,
  validateBudgetPayload,
} from "@/lib/budget-service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const budgets = await prisma.budget.findMany({
    where: { leadId: id },
    orderBy: { createdAt: "desc" },
    include: {
      concepts: { orderBy: { order: "asc" } },
      parts: { orderBy: { order: "asc" } },
    },
  });
  return NextResponse.json({ budgets });
}

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id: leadId } = await ctx.params;

  const raw = await request.json().catch(() => null);
  try {
    const payload = validateBudgetPayload(raw);
    const budget = await createBudgetForLead({
      leadId,
      payload,
      createdById: session?.user?.id ?? null,
    });

    // El envío automático de mail al crear presupuesto está deshabilitado.
    // El admin lo manda manualmente con el botón "Enviar" del lead-canvas
    // (que dispara /api/budgets/[id]/send con destinatarios y mensaje custom).
    // Si querés reactivar el aviso automático, descomentá el bloque:
    //
    //   buildBudgetContext(budget.id)
    //     .then((ctx) => {
    //       if (ctx) return sendRepairEventNotification("budget_created", ctx);
    //     })
    //     .catch((e) => console.error("[notif:budget_created] error:", e));

    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    if (err instanceof BudgetValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/crm/leads/[id]/budgets failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
