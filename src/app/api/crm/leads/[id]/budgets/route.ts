import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  BudgetValidationError,
  createBudgetForLead,
  validateBudgetPayload,
} from "@/lib/budget-service";

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
  const session = await auth();
  const { id: leadId } = await ctx.params;

  const raw = await request.json().catch(() => null);
  try {
    const payload = validateBudgetPayload(raw);
    const budget = await createBudgetForLead({
      leadId,
      payload,
      createdById: session?.user?.id ?? null,
    });
    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    if (err instanceof BudgetValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/crm/leads/[id]/budgets failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
