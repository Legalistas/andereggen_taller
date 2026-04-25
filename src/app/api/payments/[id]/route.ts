import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
