/**
 * Listas de difusión y campañas de WhatsApp del Taller (campaña de fin de
 * año, etc.). Una campaña manda una plantilla aprobada a una lista; cada
 * destinatario queda en WhatsappCampaignRecipient, así reanudar no duplica.
 */

import { prisma } from "@/lib/prisma";
import { type ContactoLeido, waIdArgentina } from "./parse";
import { sendWhatsapp, templateBySid } from "./twilio";

/** Suma contactos a la lista (crea los que no existen). Devuelve cuántos entraron. */
export async function addToList(listId: string, contactos: ContactoLeido[]) {
  if (contactos.length === 0) return 0;
  // Los nuevos entran con su nombre; a los existentes no se les pisa.
  await prisma.whatsappContact.createMany({
    data: contactos.map((c) => ({ waId: c.waId, name: c.nombre || null })),
    skipDuplicates: true,
  });
  const ids = await prisma.whatsappContact.findMany({
    where: { waId: { in: contactos.map((c) => c.waId) } },
    select: { id: true, waId: true, name: true },
  });
  // Los que ya existían sin nombre (solo escribieron) toman el de la lista.
  const nombres = new Map(contactos.map((c) => [c.waId, c.nombre]));
  for (const c of ids) {
    const nombre = nombres.get(c.waId);
    if (!c.name && nombre) {
      await prisma.whatsappContact.update({
        where: { id: c.id },
        data: { name: nombre },
      });
    }
  }
  const { count } = await prisma.whatsappListMember.createMany({
    data: ids.map((c) => ({ listId, contactId: c.id })),
    skipDuplicates: true,
  });
  return count;
}

/** Todos los clientes del taller con celular argentino válido. */
export async function customerContacts() {
  const customers = await prisma.customer.findMany({
    select: { name: true, phone: true },
  });
  const seen = new Set<string>();
  const contactos: ContactoLeido[] = [];
  let invalidos = 0;
  for (const c of customers) {
    const waId = waIdArgentina(c.phone);
    if (!waId) {
      invalidos++;
      continue;
    }
    if (seen.has(waId)) continue;
    seen.add(waId);
    contactos.push({ nombre: c.name.slice(0, 150), waId });
  }
  return { contactos, invalidos };
}

/** "{nombre}" en una variable de campaña → el nombre del destinatario. */
export function completarVariable(valor: string, nombre: string): string {
  return valor.replace(/\{nombre\}/g, () => nombre).trim();
}

/**
 * Crea la campaña con la foto de la lista en ese momento. El envío lo hace
 * runCampaign (después de responder).
 */
export async function createCampaign(opts: {
  name: string;
  listId: string;
  templateSid: string;
  variables: Record<string, string>;
  userId: string | null;
}) {
  // Valida plantilla y variables antes de crear nada ({nombre} con un ejemplo).
  const prueba = await templateBySid(
    opts.templateSid,
    Object.fromEntries(
      Object.entries(opts.variables).map(([k, v]) => [
        k,
        completarVariable(v, "Juan"),
      ]),
    ),
  );
  const members = await prisma.whatsappListMember.findMany({
    where: { listId: opts.listId },
    select: { contactId: true },
  });
  return prisma.whatsappCampaign.create({
    data: {
      name: opts.name,
      listId: opts.listId,
      templateSid: prueba.sid,
      templateName: prueba.nombre,
      variables: opts.variables,
      createdById: opts.userId,
      recipients: {
        createMany: {
          data: members.map((m) => ({ contactId: m.contactId })),
        },
      },
    },
    select: { id: true, _count: { select: { recipients: true } } },
  });
}

const BATCH = 40;
const CONCURRENCY = 8;

/**
 * Manda la campaña a los destinatarios pendientes (con `retryErrors`, también
 * a los que fallaron antes). Cada destinatario se toma con un update
 * condicional: dos corridas a la vez no le mandan dos veces.
 */
export async function runCampaign(campaignId: string, retryErrors = false) {
  const campaign = await prisma.whatsappCampaign.findUnique({
    where: { id: campaignId },
    select: { templateSid: true, variables: true },
  });
  if (!campaign) return;
  const variables = campaign.variables as Record<string, string>;

  if (retryErrors) {
    await prisma.whatsappCampaignRecipient.updateMany({
      where: { campaignId, status: "error" },
      data: { status: "pendiente", detail: null },
    });
  }
  await prisma.whatsappCampaign.update({
    where: { id: campaignId },
    data: { status: "enviando", finishedAt: null },
  });

  for (;;) {
    const batch = await prisma.whatsappCampaignRecipient.findMany({
      where: { campaignId, status: "pendiente" },
      take: BATCH,
      select: {
        id: true,
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
    if (batch.length === 0) break;

    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const r = batch[next++];
        const claimed = await prisma.whatsappCampaignRecipient.updateMany({
          where: { id: r.id, status: "pendiente" },
          data: { status: "enviando" },
        });
        if (claimed.count === 0) continue;
        if (r.contact.optOutAt) {
          await prisma.whatsappCampaignRecipient.update({
            where: { id: r.id },
            data: { status: "omitido", detail: "Pidió la baja" },
          });
          continue;
        }
        try {
          const nombre = r.contact.name ?? r.contact.profileName ?? "";
          const template = await templateBySid(
            campaign.templateSid,
            Object.fromEntries(
              Object.entries(variables).map(([k, v]) => [
                k,
                completarVariable(v, nombre),
              ]),
            ),
          );
          const message = await sendWhatsapp({
            contactId: r.contact.id,
            waId: r.contact.waId,
            template,
          });
          await prisma.whatsappCampaignRecipient.update({
            where: { id: r.id },
            data: { status: "enviado", messageId: message.id },
          });
        } catch (e) {
          await prisma.whatsappCampaignRecipient.update({
            where: { id: r.id },
            data: {
              status: "error",
              detail: (e instanceof Error ? e.message : "Error").slice(0, 255),
            },
          });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  await prisma.whatsappCampaign.update({
    where: { id: campaignId },
    data: { status: "enviada", finishedAt: new Date() },
  });
}

/** Campañas con el avance de cada una (envío y entrega). */
export async function listCampaigns() {
  const campaigns = await prisma.whatsappCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      templateName: true,
      status: true,
      createdAt: true,
      finishedAt: true,
      list: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  const ids = campaigns.map((c) => c.id);
  const [byStatus, delivery] = await Promise.all([
    prisma.whatsappCampaignRecipient.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: ids } },
      _count: true,
    }),
    prisma.whatsappCampaignRecipient.findMany({
      where: { campaignId: { in: ids }, message: { isNot: null } },
      select: { campaignId: true, message: { select: { status: true } } },
    }),
  ]);
  return campaigns.map((c) => {
    const counts: Record<string, number> = {};
    for (const g of byStatus) {
      if (g.campaignId === c.id) counts[g.status] = g._count;
    }
    const entregas = { entregados: 0, leidos: 0, noEntregados: 0 };
    for (const d of delivery) {
      if (d.campaignId !== c.id) continue;
      const s = d.message?.status;
      if (s === "delivered") entregas.entregados++;
      else if (s === "read") {
        entregas.entregados++;
        entregas.leidos++;
      } else if (s === "failed" || s === "undelivered") entregas.noEntregados++;
    }
    return { ...c, counts, ...entregas };
  });
}

/** Errores de una campaña, para corregir los números. */
export function campaignErrors(campaignId: string) {
  return prisma.whatsappCampaignRecipient.findMany({
    where: { campaignId, status: "error" },
    take: 200,
    select: {
      detail: true,
      contact: { select: { waId: true, name: true } },
    },
  });
}
