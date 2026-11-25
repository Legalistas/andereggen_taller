/**
 * POST /api/whatsapp/webhook/status — Twilio, estado de entrega de lo que
 * mandamos (queued, sent, delivered, read, failed…). Cada envío pide este
 * callback, no hace falta configurarlo en la consola.
 */

import { saveStatus } from "@/lib/whatsapp/inbox";
import { readTwilioWebhook } from "@/lib/whatsapp/webhook";

export async function POST(request: Request) {
  const read = await readTwilioWebhook(request);
  if ("error" in read) return read.error;

  const { MessageSid, MessageStatus, ErrorCode } = read.params;
  if (MessageSid && MessageStatus) {
    try {
      await saveStatus(MessageSid, MessageStatus, ErrorCode || null);
    } catch (e) {
      console.error(
        `[whatsapp] estado de ${MessageSid}:`,
        e instanceof Error ? e.message : e,
      );
      return new Response(null, { status: 500 });
    }
  }
  return new Response(null, { status: 200 });
}
