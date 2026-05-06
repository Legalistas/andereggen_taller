/**
 * GET /api/budgets/next-number
 * Devuelve el próximo número correlativo sugerido para un presupuesto nuevo
 * (max(Budget.number) + 1). Lo usa el modal "Nuevo presupuesto" para
 * pre-poblar el input antes de que el admin lo confirme o lo cambie.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { nextBudgetNumber } from "@/lib/budget-service";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const next = await nextBudgetNumber();
  return NextResponse.json({ next });
}
