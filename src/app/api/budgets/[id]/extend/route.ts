import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import {
  BudgetValidationError,
  type ExtensionPayer,
  extendBudget,
  validateBudgetPayload,
} from "@/lib/budget-service";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_PAYERS: ExtensionPayer[] = ["SEGURO", "FRANQUICIA", "PARTICULAR"];

/**
 * POST /api/budgets/[id]/extend
 * Crea una ampliación (suffix A1, A2…) del presupuesto identificado por [id].
 * El body es el mismo payload de un presupuesto normal + un campo
 * `extensionPayer` (SEGURO | FRANQUICIA | PARTICULAR) que define a qué
 * bucket de "Importes Aprobados" se suma al aceptarse la ampliación.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id: parentId } = await ctx.params;

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const payer = body.extensionPayer as ExtensionPayer | undefined;
  if (!payer || !VALID_PAYERS.includes(payer)) {
    return NextResponse.json(
      {
        error:
          "extensionPayer requerido (SEGURO | FRANQUICIA | PARTICULAR)",
      },
      { status: 400 },
    );
  }

  try {
    const payload = validateBudgetPayload(body);
    const budget = await extendBudget({
      parentId,
      payer,
      payload,
      createdById: session?.user?.id ?? null,
    });
    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    if (err instanceof BudgetValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/budgets/[id]/extend failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
