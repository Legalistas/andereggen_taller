import { createHmac, timingSafeEqual } from "node:crypto";

// ─── Firma de los webhooks ───────────────────────────────────

/**
 * X-Twilio-Signature: HMAC-SHA1 (auth token) de la URL pública exacta + los
 * parámetros del POST ordenados por nombre, en base64.
 */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function firmaValida(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
