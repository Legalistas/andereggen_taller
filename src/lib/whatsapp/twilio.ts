/**
 * WhatsApp del Taller por Twilio (misma cuenta que Legalistas, remitente
 * propio). Sin SDK: la REST API con fetch alcanza para mandar, listar
 * plantillas y bajar adjuntos.
 *
 * El número remitente se edita en Configuración → Integraciones → WhatsApp.
 * Variables de entorno: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y
 * TWILIO_WEBHOOK_BASE_URL (default NEXT_PUBLIC_APP_URL) para el callback de
 * estados.
 */

import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import {
  aPlantilla,
  type ContentItem,
  type Plantilla,
  rellenar,
  waIdArgentina,
} from "./parse";

/** Error con el status HTTP que corresponde devolver. */
export class WhatsappError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Respuesta JSON de un error de WhatsApp (o 500 si es otro). */
export function waErrorResponse(e: unknown): Response {
  if (e instanceof WhatsappError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[whatsapp]", e);
  return Response.json({ error: "Error interno" }, { status: 500 });
}

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new WhatsappError(503, "Falta configurar Twilio en el servidor.");
  }
  return {
    sid,
    auth: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
  };
}

/** Remitente del Taller dado de alta en Twilio, si no hay otro cargado. */
export const DEFAULT_SENDER = "+5493492702000";

/** Número remitente cargado en Configuración (tal como se escribió). */
export async function senderNumber(): Promise<string> {
  return (await getAppSettings()).whatsappNumber?.trim() || DEFAULT_SENDER;
}

/** "+54 9 3492 70-2000" → "whatsapp:+5493492702000". */
export function senderAddress(number: string): string {
  return `whatsapp:+${waIdArgentina(number) ?? number.replace(/\D/g, "")}`;
}

/** Base pública de los webhooks (la URL exacta que firma Twilio). */
export function webhookBase(): string {
  return (
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://intra.tallerandereggen.ar"
  ).replace(/\/+$/, "");
}

// Las plantillas aprobadas cambian poco: la lista se guarda 5 minutos.
const TEMPLATES_TTL_MS = 5 * 60 * 1000;
let templatesCache: { at: number; data: Plantilla[] } | null = null;

/** Plantillas del Taller (prefijo taller_) aprobadas por Meta. */
export async function listTemplates(): Promise<Plantilla[]> {
  if (templatesCache && Date.now() - templatesCache.at < TEMPLATES_TTL_MS) {
    return templatesCache.data;
  }
  const { auth } = creds();
  const data: Plantilla[] = [];
  let url: string | null =
    "https://content.twilio.com/v1/ContentAndApprovals?PageSize=200";
  while (url) {
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      throw new WhatsappError(
        502,
        `Twilio no devolvió las plantillas (HTTP ${res.status}).`,
      );
    }
    const page = (await res.json()) as {
      contents: ContentItem[];
      meta?: { next_page_url?: string | null };
    };
    for (const item of page.contents) {
      const p = aPlantilla(item);
      if (p) data.push(p);
    }
    url = page.meta?.next_page_url ?? null;
  }
  data.sort((a, b) => a.nombre.localeCompare(b.nombre));
  templatesCache = { at: Date.now(), data };
  return data;
}

/** Contacto (= conversación) de ese número; lo crea si no existe. */
export async function upsertContact(waId: string, name?: string | null) {
  return prisma.whatsappContact.upsert({
    where: { waId },
    create: { waId, name: name || null },
    update: name ? { name } : {},
    select: { id: true, waId: true, optOutAt: true },
  });
}

/**
 * Plantilla por nombre, con sus variables completas. Tira WhatsappError si no
 * existe o falta alguna variable.
 */
export async function templateByName(
  nombre: string,
  valores: Record<string, string>,
) {
  const plantilla = (await listTemplates()).find((p) => p.nombre === nombre);
  if (!plantilla) {
    throw new WhatsappError(
      400,
      `Falta la plantilla ${nombre} aprobada en Twilio.`,
    );
  }
  return completar(plantilla, valores);
}

export async function templateBySid(
  sid: string,
  valores: Record<string, string>,
) {
  const plantilla = (await listTemplates()).find((p) => p.sid === sid);
  if (!plantilla) {
    throw new WhatsappError(
      400,
      "Esa plantilla no existe o todavía no está aprobada por Meta.",
    );
  }
  return completar(plantilla, valores);
}

function completar(plantilla: Plantilla, valores: Record<string, string>) {
  const variables = Object.fromEntries(
    plantilla.variables.map((v) => [v.key, (valores[v.key] ?? "").trim()]),
  );
  const faltan = plantilla.variables
    .filter((v) => !variables[v.key])
    .map((v) => `{{${v.key}}}`);
  if (faltan.length) {
    throw new WhatsappError(
      400,
      `Falta completar ${faltan.join(", ")} de ${plantilla.nombre}.`,
    );
  }
  return {
    sid: plantilla.sid,
    nombre: plantilla.nombre,
    variables,
    texto: rellenar(plantilla.texto, variables),
  };
}

export type TemplateToSend = Awaited<ReturnType<typeof templateByName>>;

/**
 * Manda por Twilio y lo guarda como saliente: texto libre o plantilla (en ese
 * caso `body` es el texto completo que se ve en el hilo). Quien llama revisa
 * la ventana de 24 h para el texto libre.
 */
export async function sendWhatsapp(opts: {
  contactId: string;
  waId: string;
  body?: string;
  template?: TemplateToSend;
  sentById?: string | null;
}) {
  const { sid, auth } = creds();
  const form = new URLSearchParams({
    From: senderAddress(await senderNumber()),
    To: `whatsapp:+${opts.waId}`,
    StatusCallback: `${webhookBase()}/api/whatsapp/webhook/status`,
  });
  if (opts.template) {
    form.set("ContentSid", opts.template.sid);
    form.set("ContentVariables", JSON.stringify(opts.template.variables));
  } else {
    form.set("Body", opts.body ?? "");
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    code?: number;
    message?: string;
  };
  if (!res.ok || !json.sid) {
    // Sin contenido del mensaje en los logs.
    console.error(
      `[whatsapp] envío a ${opts.contactId} falló, código ${json.code ?? res.status}`,
    );
    throw new WhatsappError(
      502,
      `Twilio no aceptó el mensaje${json.code ? ` (código ${json.code})` : ""}: ${json.message ?? `HTTP ${res.status}`}`,
    );
  }

  const [message] = await prisma.$transaction([
    prisma.whatsappMessage.create({
      data: {
        messageSid: json.sid,
        contactId: opts.contactId,
        direction: "OUTBOUND",
        body: opts.template?.texto ?? opts.body ?? "",
        status: json.status ?? null,
        template: opts.template?.nombre ?? null,
        sentById: opts.sentById ?? null,
      },
    }),
    prisma.whatsappContact.update({
      where: { id: opts.contactId },
      data: { lastMessageAt: new Date() },
    }),
  ]);
  return message;
}

/**
 * Baja un adjunto de Twilio. La URL de media pide basic auth y redirige a una
 * URL firmada que NO tiene que recibir el header Authorization.
 */
export async function fetchMedia(url: string): Promise<Response> {
  if (!url.startsWith("https://api.twilio.com/")) {
    throw new WhatsappError(400, "Adjunto inválido");
  }
  const { auth } = creds();
  let res = await fetch(url, {
    headers: { Authorization: auth },
    redirect: "manual",
  });
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) {
    res = await fetch(location);
  }
  if (!res.ok) throw new WhatsappError(502, `Adjunto: HTTP ${res.status}`);
  return res;
}
