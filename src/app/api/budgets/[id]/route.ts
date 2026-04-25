import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import {
  BudgetValidationError,
  updateBudget,
  validateBudgetPayload,
} from "@/lib/budget-service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      concepts: { orderBy: { order: "asc" } },
      parts: { orderBy: { order: "asc" } },
      lead: {
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
            },
          },
        },
      },
    },
  });
  if (!budget)
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ budget });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const raw = await request.json().catch(() => null);
  try {
    const payload = validateBudgetPayload(raw);
    const budget = await updateBudget({ id, payload });
    return NextResponse.json({ budget });
  } catch (err) {
    if (err instanceof BudgetValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/budgets/[id] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: `Cannot delete budget in status "${existing.status}"` },
      { status: 400 },
    );
  }

  await prisma.budget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
