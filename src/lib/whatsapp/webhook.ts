import { firmaValida } from "./signature";
import { webhookBase } from "./twilio";

/**
 * Lee el POST de Twilio y valida X-Twilio-Signature. Devuelve los parámetros,
 * o la Response de error si no viene de Twilio.
 */
export async function readTwilioWebhook(
  request: Request,
): Promise<{ params: Record<string, string> } | { error: Response }> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.error("[whatsapp] falta TWILIO_AUTH_TOKEN");
    return { error: new Response(null, { status: 500 }) };
  }
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // Twilio firma la URL pública exacta: la configurada o la que llegó.
  const own = new URL(request.url);
  const urls = [`${webhookBase()}${own.pathname}${own.search}`, own.toString()];
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!urls.some((u) => firmaValida(token, signature, u, params))) {
    return { error: new Response(null, { status: 403 }) };
  }
  return { params };
}
