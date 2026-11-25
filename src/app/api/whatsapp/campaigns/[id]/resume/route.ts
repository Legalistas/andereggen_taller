/**
 * POST /api/whatsapp/campaigns/[id]/resume — sigue con los pendientes (si el
 * envío se cortó) y reintenta los que dieron error. No repite a nadie.
 */

import { after, NextResponse } from "next/server";
import { ADMIN_ROLES, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { runCampaign } from "@/lib/whatsapp/campaigns";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request, ADMIN_ROLES);
  if (authError) return authError;
  const { id } = await ctx.params;
  const exists = await prisma.whatsappCampaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json(
      { error: "Campaña no encontrada" },
      { status: 404 },
    );
  }
  after(() =>
    runCampaign(id, true).catch((e) =>
      console.error(`[whatsapp] campaña ${id}:`, e),
    ),
  );
  return NextResponse.json({ ok: true });
}
