/**
 * POST /api/users/[id]/activate
 *
 * Activa manualmente la cuenta de un usuario. Útil cuando el email de
 * verificación no llegó (problema de SMTP, spam, etc.) y el admin necesita
 * desbloquear el acceso.
 *
 * Setea:
 *   - emailVerified = true  (skip de la verificación por email)
 *   - isActive      = true  (asegura que pueda loguearse)
 *
 * Solo accesible para super_admin / admin_taller.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      emailVerified: true,
      isActive: true,
    },
    include: { role: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ user });
}
