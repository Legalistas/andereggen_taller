/**
 * GET /api/whatsapp/conversations/[id] — hilo de la conversación. Abrirlo la
 * marca como leída.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getConversation } from "@/lib/whatsapp/inbox";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  if (conversation.contact.unreadCount > 0) {
    await prisma.whatsappContact.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }
  return NextResponse.json(conversation);
}
