/**
 * Bandeja de WhatsApp del Taller: lo que llega por los webhooks de Twilio y
 * lo que se lee y contesta desde /whatsapp.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { avanzaEstado, esBaja, type InboundMessage } from "./parse";

const isDuplicate = (e: unknown) => (e as { code?: string })?.code === "P2002";

/**
 * Guarda un mensaje entrante y actualiza su contacto en una transacción. Un
 * webhook reintentado (mismo MessageSid) no se guarda dos veces. "BAJA" deja
 * al contacto sin avisos automáticos ni campañas.
 */
export async function saveInbound(m: InboundMessage): Promise<void> {
  const now = new Date();
  const baja = esBaja(m.body);
  try {
    await prisma.$transaction(async (tx) => {
      const contact = await tx.whatsappContact.upsert({
        where: { waId: m.waId },
        create: {
          waId: m.waId,
          profileName: m.profileName,
          lastInboundAt: now,
          lastMessageAt: now,
          unreadCount: 1,
          optOutAt: baja ? now : null,
        },
        update: {
          ...(m.profileName ? { profileName: m.profileName } : {}),
          lastInboundAt: now,
          lastMessageAt: now,
          unreadCount: { increment: 1 },
          ...(baja ? { optOutAt: now } : {}),
        },
        select: { id: true },
      });
      await tx.whatsappMessage.create({
        data: {
          messageSid: m.messageSid,
          contactId: contact.id,
          direction: "INBOUND",
          body: m.body,
          media: m.media.length
            ? (m.media as unknown as Prisma.InputJsonValue)
            : undefined,
          status: "received",
        },
      });
    });
  } catch (e) {
    if (!isDuplicate(e)) throw e;
  }
}

/**
 * Estado de entrega de un saliente. Solo avanza; si el mensaje todavía no se
 * guardó (el callback le puede ganar al insert) se saltea: el próximo estado
 * lo pone al día.
 */
export async function saveStatus(
  messageSid: string,
  status: string,
  errorCode: string | null,
): Promise<void> {
  const message = await prisma.whatsappMessage.findUnique({
    where: { messageSid },
    select: { id: true, status: true },
  });
  if (!message || !avanzaEstado(message.status, status)) return;
  await prisma.whatsappMessage.update({
    where: { id: message.id },
    data: { status, ...(errorCode ? { errorCode } : {}) },
  });
}

const PREVIEW = 140;

/** Conversaciones por último mensaje; busca por nombre, número o texto. */
export async function listConversations(q?: string) {
  const term = q?.trim();
  const digits = term?.replace(/\D/g, "");
  const contacts = await prisma.whatsappContact.findMany({
    where: {
      // Un contacto de agenda sin mensajes no es una conversación.
      messages: { some: {} },
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { profileName: { contains: term, mode: "insensitive" } },
              ...(digits ? [{ waId: { contains: digits } }] : []),
              {
                messages: {
                  some: { body: { contains: term, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true,
      waId: true,
      name: true,
      profileName: true,
      lastMessageAt: true,
      lastInboundAt: true,
      unreadCount: true,
      optOutAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, direction: true, media: true },
      },
    },
  });
  return contacts.map(({ messages, ...c }) => {
    const last = messages[0];
    return {
      ...c,
      lastMessage: last
        ? {
            body: last.body?.slice(0, PREVIEW) ?? null,
            direction: last.direction,
            hasMedia: Array.isArray(last.media) && last.media.length > 0,
          }
        : null,
    };
  });
}

/** Una conversación con sus últimos 300 mensajes (el más viejo primero). */
export async function getConversation(id: string) {
  const contact = await prisma.whatsappContact.findUnique({
    where: { id },
    select: {
      id: true,
      waId: true,
      name: true,
      profileName: true,
      lastInboundAt: true,
      unreadCount: true,
      optOutAt: true,
    },
  });
  if (!contact) return null;
  const messages = await prisma.whatsappMessage.findMany({
    where: { contactId: id },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      direction: true,
      body: true,
      media: true,
      status: true,
      errorCode: true,
      template: true,
      createdAt: true,
      sentBy: { select: { name: true } },
    },
  });
  return { contact, messages: messages.reverse() };
}
