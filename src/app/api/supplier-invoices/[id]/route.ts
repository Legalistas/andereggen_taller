/**
 * DELETE /api/supplier-invoices/[id]  — borra una factura importada por error
 * (se puede volver a importar desde el archivo de ARCA).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/roles";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;
  const { id } = await ctx.params;

  const { count } = await prisma.supplierInvoice.deleteMany({ where: { id } });
  if (count === 0) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
