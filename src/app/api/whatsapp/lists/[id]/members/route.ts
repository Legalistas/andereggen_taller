/**
 * POST   /api/whatsapp/lists/[id]/members
 *   { text }                 lista pegada o CSV de Google Contactos
 *   { source: "customers" }  todos los clientes del taller con celular
 * DELETE /api/whatsapp/lists/[id]/members { contactId } — saca a uno de la lista.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { addToList, customerContacts } from "@/lib/whatsapp/campaigns";
import { parsearLista } from "@/lib/whatsapp/parse";

type RouteContext = { params: Promise<{ id: string }> };

/** Un CSV de Google Contactos de varios miles de filas entra holgado. */
const MAX_TEXT = 2_000_000;

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const list = await prisma.whatsappList.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!list) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (body?.source === "customers") {
    const { contactos, invalidos } = await customerContacts();
    const added = await addToList(id, contactos);
    return NextResponse.json({
      added,
      read: contactos.length,
      invalid: invalidos,
    });
  }
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim() || text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: "Pegá la lista o subí el CSV." },
      { status: 400 },
    );
  }
  const { contactos, invalidos } = parsearLista(text);
  const added = await addToList(id, contactos);
  return NextResponse.json({
    added,
    read: contactos.length,
    invalid: invalidos.length,
    invalidLines: invalidos.slice(0, 50),
  });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (typeof body?.contactId !== "string") {
    return NextResponse.json({ error: "Falta el contacto" }, { status: 400 });
  }
  await prisma.whatsappListMember.deleteMany({
    where: { listId: id, contactId: body.contactId },
  });
  return NextResponse.json({ ok: true });
}
