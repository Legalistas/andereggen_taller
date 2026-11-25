/**
 * GET  /api/whatsapp/conversations?q=  — bandeja, por último mensaje.
 * POST /api/whatsapp/conversations     — primer mensaje a un número
 *   { phone, name?, templateSid, variables }: sin ventana abierta solo se
 *   puede escribir con una plantilla aprobada.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { listConversations } from "@/lib/whatsapp/inbox";
import { waIdArgentina } from "@/lib/whatsapp/parse";
import {
  sendWhatsapp,
  templateBySid,
  upsertContact,
  waErrorResponse,
} from "@/lib/whatsapp/twilio";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  return NextResponse.json({ data: await listConversations(q) });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  const waId = waIdArgentina(body?.phone);
  if (!waId) {
    return NextResponse.json(
      {
        error:
          "El número no es un celular argentino válido (con característica).",
      },
      { status: 400 },
    );
  }
  if (typeof body?.templateSid !== "string") {
    return NextResponse.json(
      { error: "Elegí una plantilla." },
      { status: 400 },
    );
  }
  try {
    const template = await templateBySid(
      body.templateSid,
      body.variables ?? {},
    );
    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
    const contact = await upsertContact(waId, name || null);
    await sendWhatsapp({
      contactId: contact.id,
      waId,
      template,
      sentById: session?.user?.id ?? null,
    });
    return NextResponse.json({ contactId: contact.id });
  } catch (e) {
    return waErrorResponse(e);
  }
}
