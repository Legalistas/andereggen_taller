/**
 * POST /api/whatsapp/conversations/[id]/messages
 *   { body }                     texto libre, solo con la ventana de 24 h abierta
 *   { templateSid, variables }   plantilla aprobada, en cualquier momento
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { ventanaAbierta } from "@/lib/whatsapp/parse";
import {
  sendWhatsapp,
  templateBySid,
  waErrorResponse,
} from "@/lib/whatsapp/twilio";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_TEXT = 1600;

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const contact = await prisma.whatsappContact.findUnique({
    where: { id },
    select: { id: true, waId: true, lastInboundAt: true },
  });
  if (!contact) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const sentById = session?.user?.id ?? null;
  try {
    if (typeof body?.templateSid === "string") {
      const template = await templateBySid(
        body.templateSid,
        body.variables ?? {},
      );
      const message = await sendWhatsapp({
        contactId: id,
        waId: contact.waId,
        template,
        sentById,
      });
      return NextResponse.json({ message });
    }

    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text || text.length > MAX_TEXT) {
      return NextResponse.json(
        { error: `Escribí un mensaje (hasta ${MAX_TEXT} caracteres).` },
        { status: 400 },
      );
    }
    if (!ventanaAbierta(contact.lastInboundAt)) {
      return NextResponse.json(
        {
          error:
            "Pasaron más de 24 horas desde el último mensaje del cliente: solo se le puede escribir con una plantilla aprobada.",
        },
        { status: 409 },
      );
    }
    const message = await sendWhatsapp({
      contactId: id,
      waId: contact.waId,
      body: text,
      sentById,
    });
    return NextResponse.json({ message });
  } catch (e) {
    return waErrorResponse(e);
  }
}
