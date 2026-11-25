/**
 * POST /api/whatsapp/webhook/incoming — Twilio, mensaje entrante al
 * remitente del Taller. Público (lo llama Twilio), protegido por la firma.
 * Se guarda antes de responder: si falla, 500 y Twilio reintenta.
 */

import { saveInbound } from "@/lib/whatsapp/inbox";
import { parseInbound } from "@/lib/whatsapp/parse";
import { readTwilioWebhook } from "@/lib/whatsapp/webhook";

export async function POST(request: Request) {
  const read = await readTwilioWebhook(request);
  if ("error" in read) return read.error;

  const message = parseInbound(read.params);
  if (message) {
    try {
      await saveInbound(message);
    } catch (e) {
      console.error(
        `[whatsapp] no se pudo guardar ${message.messageSid}:`,
        e instanceof Error ? e.message : e,
      );
      return new Response(null, { status: 500 });
    }
  }
  return new Response("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
