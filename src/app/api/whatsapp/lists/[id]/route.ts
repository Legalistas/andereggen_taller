/**
 * GET    /api/whatsapp/lists/[id] — integrantes de la lista.
 * DELETE /api/whatsapp/lists/[id] — borra la lista (no los contactos ni las
 *   conversaciones; las campañas ya enviadas quedan).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const members = await prisma.whatsappListMember.findMany({
    where: { listId: id },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      contact: {
        select: {
          id: true,
          waId: true,
          name: true,
          profileName: true,
          optOutAt: true,
        },
      },
    },
  });
  return NextResponse.json({ data: members.map((m) => m.contact) });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  await prisma.whatsappList.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
