/**
 * Helper para resolver el logo del PDF.
 *
 * Estrategia (en orden de preferencia):
 *   1. Si AppSettings.companyLogoUrl tiene URL absoluta → la usamos tal cual.
 *   2. Si /public/logo.png existe en el filesystem → lo leemos y devolvemos
 *      como data URI base64 (más confiable que hacer fetch HTTP server-side
 *      a la propia URL, que puede fallar en algunos deploys).
 *   3. Si nada funciona → null (el PDF se renderea sin logo, sin romper).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedDataUri: string | null | undefined; // undefined = no probado, null = no existe

async function loadLogoFromDisk(): Promise<string | null> {
  if (cachedDataUri !== undefined) return cachedDataUri;
  try {
    const path = join(process.cwd(), "public", "logo.png");
    const buffer = await readFile(path);
    const base64 = buffer.toString("base64");
    cachedDataUri = `data:image/png;base64,${base64}`;
  } catch {
    cachedDataUri = null;
  }
  return cachedDataUri;
}

/**
 * Devuelve un valor utilizable como `src` de <Image> de @react-pdf/renderer:
 * - URL absoluta si companyLogoUrl está seteado y empieza con http
 * - data URI base64 si /public/logo.png existe
 * - null si no hay logo disponible
 */
export async function resolvePdfLogo(
  companyLogoUrl: string | null,
): Promise<string | null> {
  if (companyLogoUrl && /^https?:\/\//.test(companyLogoUrl)) {
    return companyLogoUrl;
  }
  return await loadLogoFromDisk();
}
