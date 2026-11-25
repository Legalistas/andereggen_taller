/**
 * WhatsApp (Twilio) — helpers puros, portados de Legalistas
 * (backend/src/modules/whatsapp). Chequeo: bun src/lib/whatsapp/parse.check.ts
 * Sin imports de Node: también los usa el cliente (formatWaId).
 */

// ─── Mensajes entrantes ──────────────────────────────────────

export type InboundMedia = { url: string; contentType: string };

export type InboundMessage = {
  messageSid: string;
  /** WhatsApp id del cliente: dígitos con código de país. */
  waId: string;
  to: string;
  body: string | null;
  profileName: string | null;
  media: InboundMedia[];
};

/** Twilio permite hasta 10 adjuntos por mensaje. */
const MAX_MEDIA = 10;

/** Campos del form de Twilio → mensaje a guardar, o null si no es un mensaje. */
export function parseInbound(
  params: Record<string, string>,
): InboundMessage | null {
  const s = (k: string) => params[k] ?? "";
  const messageSid = s("MessageSid") || s("SmsMessageSid");
  const waId = s("WaId") || s("From").replace(/\D/g, "");
  if (!messageSid || !waId) return null;

  const count = Math.min(Number(s("NumMedia")) || 0, MAX_MEDIA);
  const media = Array.from({ length: count }, (_, i) => ({
    url: s(`MediaUrl${i}`),
    contentType: s(`MediaContentType${i}`) || "application/octet-stream",
  })).filter((m) => m.url);

  return {
    messageSid,
    waId,
    to: s("To"),
    body: s("Body") || null,
    profileName: s("ProfileName") || null,
    media,
  };
}

/** "BAJA" / "STOP": el cliente no quiere más avisos ni campañas. */
export function esBaja(body: string | null): boolean {
  return /^\s*(baja|stop)\s*[.!]*\s*$/i.test(body ?? "");
}

// ─── Estados de entrega ──────────────────────────────────────

/** Los estados pueden llegar desordenados y nunca vuelven atrás. */
const RANGO_ESTADO: Record<string, number> = {
  accepted: 0,
  scheduled: 0,
  queued: 1,
  sending: 1,
  sent: 2,
  delivered: 3,
  undelivered: 3,
  failed: 3,
  read: 4,
};

/** true si `nuevo` hace avanzar al mensaje desde `actual` (los desconocidos se ignoran). */
export function avanzaEstado(actual: string | null, nuevo: string): boolean {
  const n = RANGO_ESTADO[nuevo];
  if (n === undefined) return false;
  const a = actual ? RANGO_ESTADO[actual] : undefined;
  return a === undefined || n > a;
}

const VENTANA_MS = 24 * 60 * 60 * 1000;

/** Regla de WhatsApp: texto libre solo hasta 24 h después del último mensaje del cliente. */
export function ventanaAbierta(
  lastInboundAt: Date | null,
  now = new Date(),
): boolean {
  return (
    !!lastInboundAt && now.getTime() - lastInboundAt.getTime() < VENTANA_MS
  );
}

// ─── Teléfonos ───────────────────────────────────────────────

/**
 * WhatsApp id de un número argentino cargado a mano ("+54 9 3492 15-609000",
 * "011 15 2705-9000", "3492609000"…): 549 + característica + número, sin el 0
 * ni el 15. null si no quedan 10 dígitos nacionales.
 * shortcut: solo Argentina (todos los clientes del taller); un número extranjero da null.
 */
export function waIdArgentina(phone: string | null | undefined): string | null {
  let d = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (d.startsWith("54")) d = d.slice(2).replace(/^9/, "");
  d = d.replace(/^0/, "");
  if (d.length === 12) {
    // El 15 va justo después de la característica: 11 (2 dígitos), si no 3 o 4
    // (las características argentinas no son prefijo una de otra).
    const at = d.startsWith("11") ? [2] : [3, 4];
    const i = at.find((p) => d.slice(p, p + 2) === "15");
    if (i !== undefined) d = d.slice(0, i) + d.slice(i + 2);
  }
  return d.length === 10 ? `549${d}` : null;
}

/** "5493492609000" → "+54 9 3492 609000" para mostrar. */
export function formatWaId(waId: string): string {
  const m = waId.match(/^549(\d{4})(\d{6})$/);
  return m ? `+54 9 ${m[1]} ${m[2]}` : `+${waId}`;
}

// ─── Plantillas ──────────────────────────────────────────────

/**
 * Las plantillas del Taller y las de Legalistas viven en la misma cuenta de
 * Twilio: las del Taller se nombran con este prefijo y cada sistema muestra
 * solo las suyas.
 */
export const TALLER_PREFIX = "taller_";

export type Plantilla = {
  /** Content SID (HX…). */
  sid: string;
  nombre: string;
  categoria: string | null;
  /** Texto con {{1}}, {{2}}… tal como lo aprobó Meta. */
  texto: string;
  /** Variables a completar, con el ejemplo cargado en Twilio. */
  variables: { key: string; ejemplo: string }[];
};

/** Item crudo de la Content API (ContentAndApprovals), en snake_case. */
export type ContentItem = {
  sid: string;
  friendly_name: string;
  variables: Record<string, unknown> | null;
  types: Record<string, unknown> | null;
  approval_requests: Record<string, unknown> | null;
};

const PLACEHOLDER = /\{\{\s*(\d+)\s*\}\}/g;

/** La aprobación de WhatsApp viene plana o bajo "whatsapp", según la versión de la API. */
function aprobacion(raw: Record<string, unknown> | null) {
  if (!raw) return null;
  const w = raw.whatsapp as { status?: string; category?: string } | undefined;
  return w ?? (raw as { status?: string; category?: string });
}

/** Cuerpo del primer tipo de contenido (texto, quick reply, card…). */
function textoDe(types: Record<string, unknown> | null): string {
  for (const t of Object.values(types ?? {})) {
    const v = t as { body?: string; title?: string };
    if (v?.body || v?.title)
      return [v.title, v.body].filter(Boolean).join("\n");
  }
  return "";
}

/** Item de Twilio → plantilla del Taller, o null si no es del Taller o Meta no la aprobó. */
export function aPlantilla(item: ContentItem): Plantilla | null {
  if (!item.friendly_name.startsWith(TALLER_PREFIX)) return null;
  const ap = aprobacion(item.approval_requests);
  if (ap?.status !== "approved") return null;
  const texto = textoDe(item.types);
  const keys = new Set(Object.keys(item.variables ?? {}));
  for (const m of texto.matchAll(PLACEHOLDER)) keys.add(m[1]);
  const variables = [...keys]
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({
      key,
      ejemplo: String((item.variables ?? {})[key] ?? ""),
    }));
  return {
    sid: item.sid,
    nombre: item.friendly_name,
    categoria: ap.category ?? null,
    texto,
    variables,
  };
}

/** El texto con las variables completas: lo que lee el cliente (queda en el hilo). */
export function rellenar(
  texto: string,
  valores: Record<string, string>,
): string {
  return texto.replace(
    PLACEHOLDER,
    (todo, key: string) => valores[key] ?? todo,
  );
}

// ─── Listas de difusión ──────────────────────────────────────

export type ContactoLeido = { nombre: string; waId: string };

/** Una celda que es solo teléfono: dígitos, espacios, + - ( ), con 6 dígitos o más. */
const esTelefono = (celda: string) =>
  /^\+?[\d\s()-]+$/.test(celda) && celda.replace(/\D/g, "").length >= 6;
/** "Juan Pérez 351 555-1234" escrito en una línea, sin separadores. */
const NOMBRE_Y_TELEFONO = /^(.*?\p{L}.*?)\s+(\+?[\d\s()-]{8,})$/u;

/**
 * Lista pegada desde una planilla (tabs), escrita "Nombre; teléfono" por línea
 * o exportada de Google Contactos (CSV; varios teléfonos van separados por
 * " ::: ") → contactos. El teléfono es la celda que es solo número; el nombre,
 * la primera celda con letras. Las líneas sin teléfono (títulos, encabezados)
 * se saltean; un número que no es celular argentino va a `invalidos`. Un
 * número repetido cuenta una vez.
 */
export function parsearLista(texto: string): {
  contactos: ContactoLeido[];
  invalidos: string[];
} {
  const contactos: ContactoLeido[] = [];
  const invalidos: string[] = [];
  const vistos = new Set<string>();
  for (const linea of texto.split(/\r?\n/)) {
    const celdas = linea
      .split(/[\t;,]|:::/)
      .map((c) => c.trim().replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    let telefono = celdas.find(esTelefono);
    let nombre = celdas.find((c) => /\p{L}/u.test(c)) ?? "";
    if (!telefono) {
      const m = linea.trim().match(NOMBRE_Y_TELEFONO);
      if (!m) continue;
      nombre = m[1].trim();
      telefono = m[2].trim();
    }
    const waId = waIdArgentina(telefono);
    if (!waId) {
      invalidos.push(linea.trim());
      continue;
    }
    if (vistos.has(waId)) continue;
    vistos.add(waId);
    contactos.push({ nombre: nombre.slice(0, 150), waId });
  }
  return { contactos, invalidos };
}
