/**
 * GET /api/repairs/next-internal-number
 * Devuelve el próximo Nº interno sugerido para una reparación nueva
 * (max+1). La UI lo usa para mostrarlo antes de confirmar.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const agg = await prisma.repair.aggregate({
    _max: { internalNumber: true },
  });
  return NextResponse.json({ next: (agg._max.internalNumber ?? 0) + 1 });
}
